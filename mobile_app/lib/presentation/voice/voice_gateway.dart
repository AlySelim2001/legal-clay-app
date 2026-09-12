// Voice gateway — Text-to-Speech facade.
//
// Wraps flutter_tts behind an interface so pages never touch the plugin
// directly and tests can inject a fake. Arabic (ar-EG) voice; when no engine
// is available (common on emulators), [isAvailable] reports false and the UI
// shows an honest message instead of pretending to speak.

import 'package:flutter_tts/flutter_tts.dart';

abstract class VoiceGateway {
  bool get isAvailable;
  Future<void> speak(String text);
  Future<void> stop();
}

class FlutterTtsGateway implements VoiceGateway {
  FlutterTtsGateway() {
    _init();
  }

  final FlutterTts _tts = FlutterTts();
  bool _available = false;

  @override
  bool get isAvailable => _available;

  Future<void> _init() async {
    try {
      await _tts.setLanguage('ar-EG');
      await _tts.setSpeechRate(0.45); // slightly slower for legal content
      await _tts.setPitch(1.0);
      await _tts.awaitSpeakCompletion(true);
      _available = true;
    } on Exception {
      // No TTS engine on this device — announce state, never fake success.
      _available = false;
    }
  }

  @override
  Future<void> speak(String text) async {
    if (!_available) return;
    try {
      await _tts.setLanguage('ar-EG');
      await _tts.speak(text);
    } on Exception {
      // Swallow only the speak attempt itself; availability already honest.
    }
  }

  @override
  Future<void> stop() async {
    if (!_available) return;
    try {
      await _tts.stop();
    } on Exception {
      // ignore — stopping is best-effort
    }
  }
}
