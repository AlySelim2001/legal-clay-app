import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_app/features/audit/data/audit_repository.dart';

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
  test('parses the current audit API security contract', () async {
    final client = _FakeClient((request) async => http.Response(
          jsonEncode({
            'agent': 'LegalAuditorAgent',
            'status': 'success',
            'data': {
              'sanitized_text': 'نص منقى',
              'security_audit': {
                'vulnerabilities_found': 1,
                'details': [
                  {'severity': 'high', 'description': 'استخدام تنفيذ أوامر'},
                ],
              },
              'compliance_status': 'Review Required',
            },
          }),
          200,
        ));
    final repository = AuditRepository(httpClient: client);
    final result = await repository.auditLegalText('نص عقد تجريبي');
    expect(result.issues, hasLength(1));
    expect(result.issues.first.severity, 'high');
    expect(result.sanitizedText, 'نص منقى');
  });

  test('rejects empty text before making a request', () async {
    final repository = AuditRepository(
      httpClient: _FakeClient((_) async => http.Response('', 500)),
    );
    expect(() => repository.auditLegalText('   '), throwsArgumentError);
  });
}
