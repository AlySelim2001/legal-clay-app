import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/models/indexing_models.dart';

abstract interface class IIndexingRepository {
  Future<IndexingResult> indexLegalDocument({
    required String title,
    required String content,
    String? category,
  });
}

class IndexingRepository implements IIndexingRepository {
  final http.Client _httpClient;
  final String baseUrl;
  final Future<SharedPreferences> Function() _preferencesLoader;
  static const _pendingQueueKey = 'legal_indexing_pending_queue';

  IndexingRepository({
    http.Client? httpClient,
    this.baseUrl = 'http://10.0.2.2:8000',
    Future<SharedPreferences> Function()? preferencesLoader,
  })  : _httpClient = httpClient ?? http.Client(),
        _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance;

  @override
  Future<IndexingResult> indexLegalDocument({
    required String title,
    required String content,
    String? category,
  }) async {
    final cleanTitle = title.trim();
    final cleanContent = content.trim();
    if (cleanTitle.isEmpty || cleanContent.isEmpty) {
      throw ArgumentError('عنوان ومحتوى المستند مطلوبان لإتمام عملية الفهرسة.');
    }

    final payload = <String, dynamic>{
      'text': cleanContent,
      'article_number': cleanTitle,
      'category': category?.trim().isNotEmpty == true ? category!.trim() : 'عام',
    };

    try {
      final response = await _httpClient
          .post(
            _uri('/api/v1/documents/index'),
            headers: const {
              'Content-Type': 'application/json; charset=UTF-8',
              'Accept': 'application/json',
            },
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('Indexing service returned ${response.statusCode}.');
      }
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map) throw const FormatException('Invalid indexing response.');
      return IndexingResult.fromApiResponse(Map<String, dynamic>.from(decoded));
    } catch (_) {
      await _queueForOfflineSync(payload);
      return IndexingResult(
        status: 'queued',
        message: 'تم حفظ المستند محلياً وسيتم إرساله عند عودة الاتصال.',
        documentId: 'local_pending_${DateTime.now().millisecondsSinceEpoch}',
        indexedCharacterCount: cleanContent.length,
        isOfflineQueued: true,
      );
    }
  }

  Uri _uri(String path) =>
      Uri.parse('${baseUrl.replaceFirst(RegExp(r'/$'), '')}$path');

  Future<void> _queueForOfflineSync(Map<String, dynamic> payload) async {
    try {
      final preferences = await _preferencesLoader();
      final queue = preferences.getStringList(_pendingQueueKey) ?? <String>[];
      queue.add(jsonEncode(payload));
      await preferences.setStringList(_pendingQueueKey, queue);
    } catch (_) {
      // Queue persistence must not expose local storage errors to the UI.
    }
  }
}
