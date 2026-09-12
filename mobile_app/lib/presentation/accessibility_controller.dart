import 'package:flutter/material.dart';

import '../core/clay_palette.dart';

/// Accessibility state per the WCAG 2.2 AAA spec: font scaling up to 200%,
/// high-contrast / color-blind themes, and voice-first toggles.
class AccessibilityController extends ChangeNotifier {
  double _fontScale = 1.0;
  AccessMode _mode = AccessMode.standard;
  bool _voiceGuidance = false;

  double get fontScale => _fontScale;
  AccessMode mode => _mode;
  bool get voiceGuidance => _voiceGuidance;

  void setFontScale(double value) {
    _fontScale = value.clamp(minFontScale, maxFontScale);
    notifyListeners();
  }

  void setMode(AccessMode value) {
    _mode = value;
    notifyListeners();
  }

  void setVoiceGuidance(bool value) {
    _voiceGuidance = value;
    notifyListeners();
  }
}
