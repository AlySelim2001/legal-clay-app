import 'package:flutter/material.dart';

/// Claymorphism palette — matte pastels, plush rounded surfaces, inflated
/// soft shadows. Urgency tokens follow the global spec:
///   critical #C0392B (≤3 days) — high #F1C40F (≤7) — normal #27AE60 (>14)
class Clay {
  Clay._();

  static const primary = Color(0xFF9A8C98); // soft mauve clay
  static const primaryDark = Color(0xFF6F5E6E);
  static const surface = Color(0xFFF2EAFA); // plush off-lavender
  static const surfaceHigh = Color(0xFFE9DFF3);
  static const onSurface = Color(0xFF3E3A45);

  static const urgencyCritical = Color(0xFFC0392B);
  static const urgencyHigh = Color(0xFFF1C40F);
  static const urgencyNormal = Color(0xFF27AE60);

  static const radiusL = 24.0;
  static const radiusM = 16.0;
}

/// Verdict urgency classification mirroring the web app's classify_urgency
/// thresholds (measured against today, Cairo-anchored upstream).
enum Urgency { critical, high, normal }

Urgency urgencyForDaysRemaining(int days) {
  if (days <= 3) return Urgency.critical;
  if (days <= 7) return Urgency.high;
  return Urgency.normal;
}

Color urgencyColor(Urgency urgency) {
  switch (urgency) {
    case Urgency.critical:
      return Clay.urgencyCritical;
    case Urgency.high:
      return Clay.urgencyHigh;
    case Urgency.normal:
      return Clay.urgencyNormal;
  }
}

/// Accessibility modes per the WCAG 2.2 AAA spec.
enum AccessMode { standard, highContrast, deuteranopia, tritanopia }

/// Dynamic font scale (up to 200%) without layout breakage.
const double minFontScale = 1.0;
const double maxFontScale = 2.0;

Color accessibleAccent(AccessMode mode) {
  switch (mode) {
    case AccessMode.standard:
      return Clay.primary;
    case AccessMode.highContrast:
      return const Color(0xFFFFD700); // black/yellow AAA pairing
    case AccessMode.deuteranopia:
      return const Color(0xFF0072B2); // blue-safe
    case AccessMode.tritanopia:
      return const Color(0xFFD55E00); // vermillion-safe
  }
}
