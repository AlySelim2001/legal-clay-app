import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/models/audit_models.dart';

abstract interface class IAuditRepository {
  Future<AuditResult> auditLegalText(String content, {String? codeSnippet});

  Future<AuditResult> auditLegalDocument(
    List<int> fileBytes,
    String filename, {
    String? codeSnippet,
  });
}

class AuditRepository implements IAuditRepository {
  final http.Client _httpClient;
  final String baseUrl;
  final Future<SharedPreferences> Function() _preferencesLoader;
  static const _cachePrefix = 'legal_audit_cache_';

  AuditRepository({
    http.Client? httpClient,
    this.baseUrl = 'http://10.0.2.2:8000',
    Future<SharedPreferences> Function()? preferencesLoader,
  })  : _httpClient = httpClient ?? http.Client(),
        _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance;

  @override
  Future<AuditResult> auditLegalText(String content, {String? codeSnippet}) async {
    final text = content.trim();
    if (text.isEmpty) {
      throw ArgumentError('محتوى العقد أو النص المراد تدقيقه لا يمكن أن يكون فارغاً.');
    }

    try {
      final response = await _httpClient
          .post(
            _uri('/api/v1/agents/audit-text'),
            headers: const {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'document_text': text,
              if (codeSnippet != null && codeSnippet.trim().isNotEmpty)
                'code_snippet': codeSnippet,
            }),
          )
          .timeout(const Duration(seconds: 20));
      return await _parseAndCache(response, text);
    } catch (_) {
      final cached = await _getCached(text);
      if (cached != null) return cached.copyWithOfflineFlag(true);
      throw Exception('تعذر الاتصال بالمحرك ولا يوجد تقرير تدقيق مخزن لهذه الوثيقة.');
    }
  }

  @override
  Future<AuditResult> auditLegalDocument(
    List<int> fileBytes,
    String filename, {
    String? codeSnippet,
  }) async {
    if (fileBytes.isEmpty || filename.trim().isEmpty) {
      throw ArgumentError('يجب اختيار وثيقة صالحة للتدقيق.');
    }
    final request = http.MultipartRequest(
      'POST',
      _uri('/api/v1/agents/audit-document'),
    )
      ..files.add(http.MultipartFile.fromBytes('file', fileBytes, filename: filename));
    if (codeSnippet != null && codeSnippet.trim().isNotEmpty) {
      request.fields['code_snippet'] = codeSnippet;
    }

    try {
      final streamed = await request.send().timeout(const Duration(seconds: 30));
      final response = await http.Response.fromStream(streamed);
      if (response.statusCode != 200) {
        throw Exception('Audit service returned ${response.statusCode}.');
      }
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map) throw const FormatException('Invalid audit response.');
      return AuditResult.fromApiResponse(Map<String, dynamic>.from(decoded));
    } catch (_) {
      throw Exception('تعذر تدقيق الوثيقة؛ يلزم الاتصال بالمحرك المحلي.');
    }
  }

  Uri _uri(String path) => Uri.parse('${baseUrl.replaceFirst(RegExp(r'/$'), '')}$path');

  Future<AuditResult> _parseAndCache(http.Response response, String text) async {
    if (response.statusCode != 200) {
      throw Exception('Audit service returned ${response.statusCode}.');
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map) throw const FormatException('Invalid audit response.');
    final body = Map<String, dynamic>.from(decoded);
    final result = AuditResult.fromApiResponse(body);
    await _cache(text, body);
    return result;
  }

  Future<void> _cache(String text, Map<String, dynamic> value) async {
    try {
      final preferences = await _preferencesLoader();
      await preferences.setString('$_cachePrefix${_cacheKey(text)}', jsonEncode(value));
    } catch (_) {}
  }

  Future<AuditResult?> _getCached(String text) async {
    try {
      final preferences = await _preferencesLoader();
      final value = preferences.getString('$_cachePrefix${_cacheKey(text)}');
      if (value == null) return null;
      final decoded = jsonDecode(value);
      if (decoded is! Map) return null;
      return AuditResult.fromApiResponse(Map<String, dynamic>.from(decoded));
    } catch (_) {
      return null;
    }
  }

  String _cacheKey(String value) =>
      base64UrlEncode(utf8.encode(value)).replaceAll('=', '');
}
