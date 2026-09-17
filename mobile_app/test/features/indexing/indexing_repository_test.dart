import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_app/features/indexing/data/indexing_repository.dart';

class _FakeClient extends http.BaseClient {
  _FakeClient(this.handler);
  final Future<http.Response> Function(http.BaseRequest request) handler;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await handler(request);
    return http.StreamedResponse(
      Stream<List<int>>.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      request: request,
    );
  }
}

void main() {
  test('indexes against the current local-ai request and response contract', () async {
    final client = _FakeClient((request) async {
      final body = jsonDecode(await request.finalize().bytesToString()) as Map;
      expect(body['text'], 'نص مادة قانونية');
      expect(body['article_number'], 'مادة 1');
      return http.Response(
        jsonEncode({
          'status': 'success',
          'message': 'Indexed successfully',
          'document_id': 'doc_001',
          'indexed_char_count': 15,
        }),
        200,
      );
    });
    final repository = IndexingRepository(httpClient: client);
    final result = await repository.indexLegalDocument(
      title: 'مادة 1',
      content: 'نص مادة قانونية',
    );
    expect(result.status, 'success');
    expect(result.documentId, 'doc_001');
    expect(result.indexedCharacterCount, 15);
  });

  test('rejects missing title or content before a request', () async {
    final repository = IndexingRepository(
      httpClient: _FakeClient((_) async => http.Response('', 500)),
    );
    expect(
      () => repository.indexLegalDocument(title: '', content: 'محتوى'),
      throwsArgumentError,
    );
  });
}
