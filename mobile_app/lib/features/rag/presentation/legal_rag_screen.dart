import 'package:flutter/material.dart';

import '../data/rag_repository.dart';
import '../domain/models/rag_models.dart';

class LegalRagScreen extends StatefulWidget {
  final IRagRepository repository;

  const LegalRagScreen({super.key, required this.repository});

  @override
  State<LegalRagScreen> createState() => _LegalRagScreenState();
}

class _LegalRagScreenState extends State<LegalRagScreen> {
  final _queryController = TextEditingController();
  RagResult? _result;
  String? _errorMessage;
  bool _isLoading = false;

  Future<void> _performSearch() async {
    final query = _queryController.text.trim();
    if (query.isEmpty || _isLoading) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final result = await widget.repository.executeLegalRagQuery(query);
      if (!mounted) return;
      setState(() => _result = result);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          appBar: AppBar(title: const Text('المستشار القانوني الذكي'), centerTitle: true),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              TextField(
                controller: _queryController,
                textDirection: TextDirection.rtl,
                minLines: 1,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'أدخل استفسارك القانوني',
                  hintText: 'مثال: ما هي حقوق العامل؟',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    onPressed: _isLoading ? null : _performSearch,
                    icon: const Icon(Icons.search),
                  ),
                ),
                onSubmitted: (_) => _performSearch(),
              ),
              const SizedBox(height: 16),
              if (_isLoading) const CircularProgressIndicator()
              else if (_errorMessage != null) _ErrorCard(message: _errorMessage!)
              else if (_result != null) Expanded(child: _ResultView(result: _result!))
              else const Text('اكتب سؤالك للحصول على إجابة مبنية على المصادر القانونية.'),
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

class _ResultView extends StatelessWidget {
  final RagResult result;
  const _ResultView({required this.result});
  @override
  Widget build(BuildContext context) => ListView(children: [
        if (result.isOfflineCached)
          const Card(child: ListTile(leading: Icon(Icons.offline_bolt), title: Text('نتيجة محفوظة — وضع عدم الاتصال'))),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('الإجابة:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const Divider(),
              SelectableText(result.answer),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        const Text('المصادر القانونية:', style: TextStyle(fontWeight: FontWeight.bold)),
        ...result.sources.map((source) => Card(
              child: ListTile(
                title: Text(source.articleNumber ?? 'مصدر قانوني'),
                subtitle: Text(source.text),
                trailing: Text('${(source.score * 100).toStringAsFixed(0)}%'),
              ),
            )),
      ]);
}
