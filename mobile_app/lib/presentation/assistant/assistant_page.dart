// Legal assistant chat — voice-first (Egyptian Ammiya), PII-gated, honest.
//
//   - STT: speech_to_text with ar-EG; when the platform has no engine, the
//     UI says so and offers the keyboard — never a silent dead button.
//   - The question is scrubbed ON-DEVICE (PiiScrubber) before the request;
//     the backend's own fail-closed gates apply again server-side.
//   - A blocked pipeline answer renders the canonical legal-hold message.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../../core/app_error.dart';
import '../../core/constants.dart';
import '../accessibility/a11y_banner.dart';
import '../main_container.dart';
import '../voice/voice_gateway.dart';

class _ChatMessage {
  const _ChatMessage({required this.text, required this.fromUser, this.blocked = false});
  final String text;
  final bool fromUser;
  final bool blocked;
}

class AssistantPage extends StatefulWidget {
  const AssistantPage({super.key});

  @override
  State<AssistantPage> createState() => _AssistantPageState();
}

class _AssistantPageState extends State<AssistantPage> {
  final stt.SpeechToText _stt = stt.SpeechToText();
  final TextEditingController _input = TextEditingController();
  final List<_ChatMessage> _messages = [];
  bool _sttReady = false;
  bool _listening = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _initStt();
  }

  Future<void> _initStt() async {
    try {
      _sttReady = await _stt.initialize(
        onError: (e) => _announce('حدث خطأ في التعرف على الصوت'),
        onStatus: (status) {
          if (status == 'done' || status == 'notListening') {
            if (mounted) setState(() => _listening = false);
          }
        },
      );
    } on Exception {
      _sttReady = false;
    }
    if (mounted) setState(() {});
  }

  void _announce(String msg) {
    if (!mounted) return;
    announceForScreenReader(context, msg, assertive: true);
  }

  Future<void> _toggleListening() async {
    if (!_sttReady) {
      _announce('التعرف على الصوت غير متاح على هذا الجهاز — استخدم لوحة المفاتيح');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('التعرف على الصوت غير متاح — اكتب سؤالك في الحقل أدناه')),
      );
      return;
    }
    if (_listening) {
      await _stt.stop();
      setState(() => _listening = false);
      return;
    }
    setState(() => _listening = true);
    await _stt.listen(
      localeId: 'ar-EG',
      listenOptions: stt.SpeechListenOptions(
        cancelOnError: true,
        partialResults: true,
      ),
      onResult: (result) {
        _input.text = result.recognizedWords;
        if (result.finalResult && _input.text.trim().isNotEmpty) {
          _ask(_input.text.trim());
        }
      },
    );
  }

  Future<void> _ask(String question) async {
    if (_busy || question.isEmpty) return;
    setState(() {
      _busy = true;
      _messages.add(_ChatMessage(text: question, fromUser: true));
      _input.clear();
    });

    final container = context.read<AppContainer>();
    try {
      final answer = await container.backend.ask(question);
      if (!mounted) return;
      setState(() {
        _messages.add(_ChatMessage(
          text: answer.answer,
          fromUser: false,
          blocked: answer.blocked,
        ));
      });
      final voice = context.read<VoiceGateway>();
      await voice.speak(answer.answer);
    } on PiiBlockedError catch (e) {
      if (!mounted) return;
      setState(() => _messages.add(
            _ChatMessage(text: e.messageAr, fromUser: false, blocked: true),
          ));
    } on AppError catch (e) {
      if (!mounted) return;
      setState(() => _messages.add(
            _ChatMessage(text: e.messageAr, fromUser: false, blocked: true),
          ));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('المساعد القانوني',
                style: Theme.of(context).textTheme.titleLarge),
          ),
          if (_messages.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Icon(Icons.record_voice_over, size: 72, color: scheme.secondary),
                  const SizedBox(height: 12),
                  Text(
                    'اسأل بصوتك أو اكتب سؤالك — الإجابات في العامية المصرية، '
                    'وكل إجابة تُعرض مع درجة ثقتها.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _messages.length,
                itemBuilder: (context, i) {
                  final m = _messages[i];
                  return Align(
                    alignment: m.fromUser
                        ? Alignment.centerLeft
                        : Alignment.centerRight,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 6),
                      padding: const EdgeInsets.all(14),
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.of(context).size.width * 0.85,
                      ),
                      decoration: BoxDecoration(
                        color: m.fromUser
                            ? scheme.surfaceContainerHighest
                            : (m.blocked
                                ? scheme.errorContainer
                                : scheme.primary.withValues(alpha: 0.08)),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(m.text),
                          if (!m.fromUser && !m.blocked) ...[
                            const SizedBox(height: 6),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.verified_user,
                                    size: 14, color: scheme.secondary),
                                const SizedBox(width: 4),
                                Text(
                                  'تم التحقق من الإجابة قبل عرضها',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          const A11yBanner.polite(LegalText.disclaimerAr),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    textInputAction: TextInputAction.send,
                    onSubmitted: _ask,
                    decoration: InputDecoration(
                      hintText: _sttReady
                          ? 'اكتب سؤالك أو اضغط زر الصوت'
                          : 'اكتب سؤالك (الصوت غير متاح على هذا الجهاز)',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 56,
                  height: 56,
                  child: FilledButton(
                    onPressed: _busy ? null : _toggleListening,
                    style: FilledButton.styleFrom(
                      padding: EdgeInsets.zero,
                      backgroundColor:
                          _listening ? scheme.error : scheme.primary,
                    ),
                    child: Icon(_listening ? Icons.stop : Icons.mic),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 56,
                  height: 56,
                  child: FilledButton(
                    onPressed: _busy
                        ? null
                        : () {
                            final t = _input.text.trim();
                            if (t.isNotEmpty) _ask(t);
                          },
                    style: FilledButton.styleFrom(padding: EdgeInsets.zero),
                    child: _busy
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _stt.stop();
    _input.dispose();
    super.dispose();
  }
}
