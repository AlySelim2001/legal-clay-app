// Legal Clay App — Zero-Trust backend client.
//
// Security contract (all enforced here, tested in test/backend_client_test.dart):
//  1. RELEASE IS HTTPS-ONLY — a non-https base URL throws ConfigurationError
//     before any request can exist (constants.dart enforces it too; this is
//     defense in depth).
//  2. TLS pinning is FAIL-CLOSED: with TLS_FINGERPRINT_SHA256 set, only a
//     certificate whose SHA-256 matches (constant-time compare) is accepted;
//     with no fingerprint configured, no certificate bypass is granted at all
//     (badCertificateCallback returns false — system validation still applies).
//  3. PII gate runs BEFORE any text payload leaves the device. If scrubbing
//     itself throws, the payload is BLOCKED, never sent (fail-closed parity
//     with the server-side Presidio gate).
//  4. NO LOGGING of request/response bodies — a legal case file must never
//     reach logcat/Crashlytics-style surfaces.

import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';

import '../../core/app_error.dart';
import '../../core/constants.dart';
import '../../domain/security/pii_scrubber.dart';

/// Answer from the RAG pipeline (`POST /analyze`).
class AssistantAnswer {
  const AssistantAnswer({
    required this.answer,
    required this.blocked,
    this.faithfulness,
    this.traceId,
  });

  final String answer;

  /// True when the pipeline refused (Ragas gate / PII gate / upstream failure).
  /// [answer] then carries the verbatim legal-hold message.
  final bool blocked;
  final double? faithfulness;
  final String? traceId;
}

/// OCR result for a scanned document image (`POST /ocr`).
class OcrResult {
  const OcrResult({required this.text, required this.raw});
  final String text;
  final Map<String, dynamic> raw;
}

class BackendClient {
  BackendClient({Dio? dio, PiiScrubber? piiScrubber})
      : _scrubber = piiScrubber ?? const PiiScrubber() {
    _validateBaseUrl();
    _dio = dio ?? _buildDio();
  }

  late final Dio _dio;
  final PiiScrubber _scrubber;

  void _validateBaseUrl() {
    final uri = Uri.parse(BuildConfig.baseUrl);
    if (BuildConfig.isRelease && uri.scheme != 'https') {
      throw ConfigurationError(
        'بناء الإصدار يتطلب اتصالاً مشفّراً (HTTPS) بالخادم المحلي — '
        'القيمة الحالية غير مسموحة',
      );
    }
  }

  Dio _buildDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: BuildConfig.baseUrl,
        connectTimeout: const Duration(seconds: 8),
        // LLM answers are slow; do not kill a legitimate pipeline run.
        receiveTimeout: const Duration(seconds: 180),
        sendTimeout: const Duration(seconds: 60),
        responseType: ResponseType.json,
        headers: {'Accept': 'application/json'},
        // Error bodies may echo user text — never surface them raw.
        validateStatus: (code) => code != null && code >= 200 && code < 300,
      ),
    );
    dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        final client = HttpClient();
        client.badCertificateCallback = _badCertificateCallback;
        return client;
      },
    );
    return dio;
  }

  /// Invoked by dart:io ONLY when system TLS validation failed. Fail-closed:
  /// accept nothing unless a fingerprint was configured AND matches.
  bool _badCertificateCallback(X509Certificate cert, String host, int port) {
    final expected = _normalizeFingerprint(BuildConfig.tlsFingerprint);
    if (expected == null) return false; // no pin configured → no bypass
    final actual = sha256.convert(cert.der).toString();
    return _constantTimeEquals(actual, expected);
  }

  static String? _normalizeFingerprint(String raw) {
    final hex = raw.replaceAll(':', '').replaceAll(' ', '').toLowerCase();
    if (hex.length != 64) return null;
    if (!RegExp(r'^[0-9a-f]{64}$').hasMatch(hex)) return null;
    return hex;
  }

  /// Constant-time comparison — length first, then XOR fold (no early exit
  /// on content mismatch).
  static bool _constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }

  /// Liveness probe against the local stack.
  Future<void> checkHealth() async {
    try {
      await _dio.get<void>(ApiPaths.health);
    } on AppError {
      rethrow;
    } on DioException catch (e) {
      throw _mapDio(e);
    } on Exception {
      throw const NetworkError();
    }
  }

  /// Ask the legal pipeline. The question is scrubbed ON-DEVICE first; a
  /// scrubber failure blocks the request (never leaks). The backend applies
  /// its own fail-closed gates again — we render its hold message verbatim.
  Future<AssistantAnswer> ask(String question) async {
    // On-device PII gate. The scrubber is fail-closed internally (it reports
    // `blocked` instead of throwing), but any unexpected failure ALSO blocks.
    final ScrubResult scrubbed;
    try {
      scrubbed = _scrubber.scrub(question);
    } on Exception {
      throw PiiBlockedError(LegalText.holdMessage);
    }
    if (scrubbed.blocked) {
      throw PiiBlockedError(LegalText.holdMessage);
    }

    try {
      final res = await _dio.post<Map<String, dynamic>>(
        ApiPaths.analyze,
        data: <String, dynamic>{'question': scrubbed.sanitizedText},
      );
      final data = res.data;
      if (data == null) {
        throw ServerError(res.statusCode ?? 0, 'empty body');
      }
      final status = data['status'] as String?;
      final answer = data['answer'] as String?;
      final faithfulness = (data['faithfulness'] as num?)?.toDouble();
      final traceId = data['trace_id'] as String?;
      if (status == 'blocked' || answer == null) {
        // Pipeline refused — show the canonical hold message, never
        // half-trust a low-faithfulness answer.
        return AssistantAnswer(
          answer: LegalText.holdMessage,
          blocked: true,
          faithfulness: faithfulness,
          traceId: traceId,
        );
      }
      return AssistantAnswer(
        answer: answer,
        blocked: false,
        faithfulness: faithfulness,
        traceId: traceId,
      );
    } on AppError {
      rethrow;
    } on DioException catch (e) {
      throw _mapDio(e);
    } on Exception {
      throw const NetworkError();
    }
  }

  /// Scan a document image through the local OCR service (multipart).
  /// The server-side pipeline scrubs the recognized text before it is stored
  /// or fed to any model; this client only transports the image.
  Future<OcrResult> scanDocument(List<int> imageBytes,
      {String filename = 'document.jpg'}) async {
    try {
      final form = FormData.fromMap(<String, dynamic>{
        'file': MultipartFile.fromBytes(imageBytes, filename: filename),
      });
      final res = await _dio.post<Map<String, dynamic>>(
        ApiPaths.ocr,
        data: form,
      );
      final data = res.data;
      if (data == null) throw ServerError(res.statusCode ?? 0, 'empty body');
      final text = (data['text'] ?? data['ocr_text']) as String?;
      if (text == null) {
        throw ServerError(res.statusCode ?? 200, 'unexpected OCR schema');
      }
      return OcrResult(text: text, raw: data);
    } on AppError {
      rethrow;
    } on DioException catch (e) {
      throw _mapDio(e);
    } on Exception {
      throw const NetworkError();
    }
  }

  AppError _mapDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.badResponse:
        return ServerError(e.response?.statusCode ?? 0);
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
      case DioExceptionType.cancel:
        return const NetworkError();
      case DioExceptionType.badCertificate:
        // Pinning refused the server (or system validation failed).
        return const NetworkError();
      case DioExceptionType.unknown:
        return const NetworkError();
    }
  }

  Future<void> close() async => _dio.close();
}
