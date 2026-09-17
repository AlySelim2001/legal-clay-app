import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/models/rag_models.dart';

abstract interface class IRagRepository {
  Future<RagResult> executeLegalRagQuery(String query, {int limit = 5});
}

class RagRepository implements IRagRepository {
  final http.Client _httpClient;
  final String baseUrl;
  final Future<SharedPreferences> Function() _preferencesLoader;
  static const String _cachePrefix = 'legal_rag_cache_';

  RagRepository({
    http.Client? httpClient,
    this.baseUrl = 'http://10.0.2.2:8000',
    Future<SharedPreferences> Function()? preferencesLoader,
  })  : _httpClient = httpClient ?? http.Client(),
        _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance;

  @override
  Future<RagResult> executeLegalRagQuery(String query, {int limit = 5}) async {
    final sanitizedQuery = query.trim();
    if (sanitizedQuery.isEmpty) {
      throw ArgumentError('الاستعلام القانوني لا يمكن أن يكون فارغاً.');
    }
    if (limit < 1 || limit > 50) {
      throw ArgumentError('عدد المصادر يجب أن يكون بين 1 و50.');
    }

    try {
      final response = await _httpClient
          .post(
            Uri.parse('${baseUrl.replaceFirst(RegExp(r'/$'), '')}/api/v1/agents/rag'),
            headers: const {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json',
            },
            body: jsonEncode({'query': sanitizedQuery, 'limit': limit}),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode != 200) {
        throw Exception('Local AI request failed: ${response.statusCode}');
      }
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is! Map) throw const FormatException('Invalid RAG response.');
      final responseMap = Map<String, dynamic>.from(body);
      final result = RagResult.fromApiResponse(responseMap, sanitizedQuery);
      await _cacheQueryResult(sanitizedQuery, responseMap);
      return result;
    } catch (_) {
      final cached = await _getOfflineCachedResult(sanitizedQuery);
      if (cached != null) return cached.copyWithOfflineFlag(true);
      throw Exception('تعذر الاتصال بالمحرك المحلي ولا توجد نتيجة مخزنة لهذا الاستعلام.');
    }
  }

  Future<void> _cacheQueryResult(String query, Map<String, dynamic> data) async {
    try {
      final preferences = await _preferencesLoader();
      await preferences.setString('$_cachePrefix${_stableKey(query)}', jsonEncode(data));
    } catch (_) {
      // Cache failure must not make a successful online query fail.
    }
  }

  Future<RagResult?> _getOfflineCachedResult(String query) async {
    try {
      final preferences = await _preferencesLoader();
      final value = preferences.getString('$_cachePrefix${_stableKey(query)}');
      if (value == null) return null;
      final decoded = jsonDecode(value);
      if (decoded is! Map) return null;
      return RagResult.fromApiResponse(Map<String, dynamic>.from(decoded), query);
    } catch (_) {
      return null;
    }
  }

  String _stableKey(String value) => base64UrlEncode(utf8.encode(value)).replaceAll('=', '');
}
