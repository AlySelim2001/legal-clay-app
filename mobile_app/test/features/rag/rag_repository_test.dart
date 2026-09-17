import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/features/rag/data/rag_repository.dart';

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
  test('parses a successful Arabic RAG response', () async {
    final client = _FakeClient((request) async => http.Response(
          jsonEncode({
            'agent': 'LegalRAGAgent',
            'status': 'success',
            'message': 'OK',
            'data': {
              'query': 'حقوق العامل',
              'answer': 'وفقاً لقانون العمل...',
              'sources': [
                {
                  'id': '123',
                  'score': 0.89,
                  'payload': {'text': 'نص المادة 45', 'article_number': 'مادة 45'},
                },
              ],
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        ));
    final repository = RagRepository(httpClient: client);
    final result = await repository.executeLegalRagQuery('حقوق العامل');
    expect(result.answer, contains('وفقاً لقانون العمل'));
    expect(result.sources.single.articleNumber, 'مادة 45');
  });

  test('rejects an empty query before making a request', () async {
    final repository = RagRepository(httpClient: _FakeClient((_) async => http.Response('', 500)));
    expect(() => repository.executeLegalRagQuery('   '), throwsArgumentError);
  });
}
