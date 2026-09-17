import 'package:flutter/material.dart';

import '../data/indexing_repository.dart';
import '../domain/models/indexing_models.dart';

class DocumentIndexingScreen extends StatefulWidget {
  final IIndexingRepository repository;

  const DocumentIndexingScreen({super.key, required this.repository});

  @override
  State<DocumentIndexingScreen> createState() => _DocumentIndexingScreenState();
}

class _DocumentIndexingScreenState extends State<DocumentIndexingScreen> {
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  IndexingResult? _result;
  String? _error;
  bool _loading = false;

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final content = _contentController.text.trim();
    if (title.isEmpty || content.isEmpty || _loading) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.repository.indexLegalDocument(
        title: title,
        content: content,
      );
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
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('فهرسة الوثائق القانونية'),
            centerTitle: true,
          ),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: _titleController,
                  textDirection: TextDirection.rtl,
                  decoration: const InputDecoration(
                    labelText: 'عنوان الوثيقة أو رقم المادة',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _contentController,
                  textDirection: TextDirection.rtl,
                  maxLines: 7,
                  decoration: const InputDecoration(
                    labelText: 'نص الوثيقة القانونية',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _loading ? null : _submit,
                    icon: const Icon(Icons.cloud_upload),
                    label: const Text('فهرسة المستند'),
                  ),
                ),
                const SizedBox(height: 16),
                if (_loading)
                  const CircularProgressIndicator()
                else if (_error != null)
                  _ErrorCard(message: _error!)
                else if (_result != null)
                  _StatusCard(result: _result!)
                else
                  const Text('أدخل عنوان المستند ونصه لبدء الفهرسة.'),
              ],
            ),
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
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(message),
        ),
      );
}

class _StatusCard extends StatelessWidget {
  final IndexingResult result;
  const _StatusCard({required this.result});

  @override
  Widget build(BuildContext context) => Card(
        color: result.isOfflineQueued ? Colors.amber.shade50 : Colors.green.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  result.isOfflineQueued ? Icons.schedule : Icons.check_circle,
                ),
                title: Text(
                  result.isOfflineQueued ? 'معلق للتزامن' : 'تمت الفهرسة بنجاح',
                ),
              ),
              Text(result.message),
              if (!result.isOfflineQueued) ...[
                const Divider(),
                Text('معرّف الوثيقة: ${result.documentId}'),
                Text('عدد الأحرف المفهرسة: ${result.indexedCharacterCount}'),
              ],
            ],
          ),
        ),
      );
}
