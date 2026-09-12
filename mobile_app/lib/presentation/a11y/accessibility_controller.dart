// Accessibility controller — WCAG 2.2-oriented in-session settings.
//
//   - font scale: 100% / 125% / 150% / 200% (layout is rem-based via
//     MediaQuery textScaler in main.dart, so nothing breaks at 200%)
//   - high contrast: flips the clay theme to black/yellow (AAA body text)
//   - spoken answers: auto-TTS of legal results in Egyptian Arabic

import 'package:flutter/foundation.dart';

enum FontScale { normal, large, larger, max }

extension FontScaleValue on FontScale {
  double get value => switch (this) {
        FontScale.normal => 1.0,
        FontScale.large => 1.25,
        FontScale.larger => 1.5,
        FontScale.max => 2.0,
      };

  String get labelAr => switch (this) {
        FontScale.normal => 'عادي (100%)',
        FontScale.large => 'كبير (125%)',
        FontScale.larger => 'أكبر (150%)',
        FontScale.max => 'الأكبر (200%)',
      };
}

class AccessibilityController extends ChangeNotifier {
  FontScale _fontScale = FontScale.normal;
  bool _highContrast = false;
  bool _spokenAnswers = true;

  FontScale get fontScale => _fontScale;
  bool get highContrast => _highContrast;
  bool get spokenAnswers => _spokenAnswers;

  set fontScale(FontScale s) {
    _fontScale = s;
    notifyListeners();
  }

  set highContrast(bool v) {
    _highContrast = v;
    notifyListeners();
  }

  set spokenAnswers(bool v) {
    _spokenAnswers = v;
    notifyListeners();
  }
}
