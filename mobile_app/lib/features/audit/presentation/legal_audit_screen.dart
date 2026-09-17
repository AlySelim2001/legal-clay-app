import 'package:flutter/material.dart';

import '../data/audit_repository.dart';
import '../domain/models/audit_models.dart';

class LegalAuditScreen extends StatefulWidget {
  final IAuditRepository repository;

  const LegalAuditScreen({super.key, required this.repository});

  @override
  State<LegalAuditScreen> createState() => _LegalAuditScreenState();
}

class _LegalAuditScreenState extends State<LegalAuditScreen> {
  final _contentController = TextEditingController();
  AuditResult? _result;
  String? _error;
  bool _loading = false;

  Future<void> _audit() async {
    final text = _contentController.text.trim();
    if (text.isEmpty || _loading) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.repository.auditLegalText(text);
      if (!mounted) return;
      setState(() => _result = result);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          appBar: AppBar(title: const Text('تدقيق العقود والوثائق'), centerTitle: true),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              TextField(
                controller: _contentController,
                maxLines: 6,
                textDirection: TextDirection.rtl,
                decoration: const InputDecoration(
                  labelText: 'ألصق نص العقد أو الاتفاقية هنا',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : _audit,
                  icon: const Icon(Icons.gavel),
                  label: const Text('بدء التدقيق القانوني'),
                ),
              ),
              const SizedBox(height: 16),
              if (_loading) const CircularProgressIndicator()
              else if (_error != null) _ErrorCard(message: _error!)
              else if (_result != null) Expanded(child: _Report(result: _result!))
              else const Text('أدخل النص لبدء الفحص.'),
            ]),
          ),
        ),
      );
}

class _ErrorCard extends StatelessWidget {
  final String message;
  const _ErrorCard({required this.message});
  @override
  Widget build(BuildContext context) => Card(
        color: Colors.red.shade50,
        child: Padding(padding: const EdgeInsets.all(12), child: Text(message)),
      );
}

class _Report extends StatelessWidget {
  final AuditResult result;
  const _Report({required this.result});
  @override
  Widget build(BuildContext context) => ListView(children: [
        if (result.isOfflineCached)
          const Card(child: ListTile(leading: Icon(Icons.offline_bolt), title: Text('تقرير محفوظ — وضع عدم الاتصال'))),
        Card(
          child: ListTile(
            title: const Text('نسبة التوافق القانوني'),
            trailing: Chip(label: Text('${result.complianceScore}%')),
            subtitle: Text(result.summary),
          ),
        ),
        const SizedBox(height: 12),
        const Text('الملاحظات القانونية', style: TextStyle(fontWeight: FontWeight.bold)),
        ...result.issues.map((issue) => Card(
              child: ListTile(
                leading: Icon(
                  issue.severity == 'critical' ? Icons.error : Icons.warning_amber,
                  color: issue.severity == 'critical' ? Colors.red : Colors.orange,
                ),
                title: Text(issue.description),
                subtitle: Text(issue.recommendation),
              ),
            )),
      ]);
}
