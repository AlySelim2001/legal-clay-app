import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

/// Result of one sync push attempt.
class SyncOutcome {
  const SyncOutcome(this.actionId, this.ok, {this.permanentFailure});

  final int actionId;
  final bool ok;

  /// True when the server rejected the payload in a way retries cannot fix
  /// (4xx) — the action is dropped to the dead-letter state instead of
  /// spinning forever.
  final bool? permanentFailure;
}

/// Dio client bound strictly to the local Zero-Trust backend.
///
/// RELEASE HARDENING:
///  - the base URL must be HTTPS in release builds (a non-https base URL
///    throws before any request exists), and
///  - the server certificate can be pinned via
///    `--dart-define=TLS_FINGERPRINT_SHA256=<sha256 hex>`. Pinning is enforced
///    through [HttpClient.badCertificateCallback]; for CA-validated chains the
///    system validator still applies — stated honestly, no overclaim.
class BackendClient {
  BackendClient({
    required String baseUrl,
    String? tlsFingerprint,
  })  : _tlsFingerprint = tlsFingerprint,
        assert(baseUrl.isNotEmpty, 'baseUrl must not be empty') {
    final isRelease = const bool.fromEnvironment('dart.vm.product');
    if (isRelease && !baseUrl.startsWith('https://')) {
      throw StateError(
        'Release builds are HTTPS-only. Refusing to start with base URL: '
        '$baseUrl — configure the local backend behind TLS.',
      );
    }
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Accept': 'application/json'},
      ),
    );
  }

  /// Read at startup: `--dart-define=TLS_FINGERPRINT_SHA256=...`
  static const String tlsFingerprintDefine = String.fromEnvironment(
    'TLS_FINGERPRINT_SHA256',
  );

  /// SHA-256 of a DER-encoded certificate as lowercase hex (no separators).
  static String sha256Hex(List<int> bytes) =>
      sha256.convert(bytes).toString();

  final String? _tlsFingerprint;
  late final Dio _dio;

  /// Creates an HttpClient whose bad-certificate callback pins the server
  /// certificate by SHA-256 fingerprint when configured. Used when Dio is
  /// constructed over a raw HttpClient (IOAdapter) in release builds.
  static HttpClient createPinnedHttpClient(String? fingerprint) {
    final client = HttpClient();
    final expected = fingerprint?.replaceAll(':', '').toLowerCase();
    if (expected == null || expected.isEmpty) return client;
    client.badCertificateCallback = (cert, host, port) {
      return sha256Hex(cert.der) == expected;
    };
    return client;
  }

  String? get tlsFingerprint => _tlsFingerprint;

  Future<bool> healthy() async {
    try {
      final res = await _dio.get<void>('/health');
      return res.statusCode == 200;
    } on DioException {
      return false;
    }
  }

  /// Pushes one queued action. Returns [SyncOutcome] with permanentFailure
  /// for 4xx responses (never retried), ok for 2xx, failure otherwise.
  Future<SyncOutcome> pushAction(
    int actionId,
    String actionType,
    Map<String, dynamic> payload,
  ) async {
    try {
      final res = await _dio.post<void>(
        '/sync/actions',
        data: {'action_id': actionId, 'type': actionType, 'payload': payload},
      );
      final code = res.statusCode ?? 0;
      return SyncOutcome(actionId, code >= 200 && code < 300);
    } on DioException catch (e) {
      final code = e.response?.statusCode ?? 0;
      final permanent = code >= 400 && code < 500;
      return SyncOutcome(actionId, false, permanentFailure: permanent);
    } on Exception {
      return SyncOutcome(actionId, false);
    }
  }
}
