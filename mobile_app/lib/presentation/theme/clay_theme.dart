// Legal Clay App — Claymorphism theme.
//
// Tactile and soft: plush rounded surfaces, matte pastel base, inflated
// multi-layer shadows for playful-but-polished depth. Touch targets are
// ≥ 56dp everywhere (WCAG 2.5.8++). The high-contrast variant (black/yellow)
// keeps body-text contrast ≥ 7:1 for AAA.

import 'package:flutter/material.dart';

import '../a11y/accessibility_controller.dart';

class ClayPalette {
  const ClayPalette._();

  // Base clay
  static const Color surface = Color(0xFFF5EFE6); // warm matte clay
  static const Color surfaceHigh = Color(0xFFEFE6D8);
  static const Color ink = Color(0xFF3E2723); // deep brown text
  static const Color inkSoft = Color(0xFF6D4C41);
  static const Color primary = Color(0xFF795548);
  static const Color accent = Color(0xFF00695C);

  // Urgency (mirrors web tokens)
  static const Color urgencyCritical = Color(0xFFC0392B);
  static const Color urgencyHigh = Color(0xFFF1C40F);
  static const Color urgencyNormal = Color(0xFF27AE60);

  // High contrast (black/yellow)
  static const Color hcSurface = Color(0xFF000000);
  static const Color hcInk = Color(0xFFFFD600);
  static const Color hcPrimary = Color(0xFFFFD600);
  static const Color hcAccent = Color(0xFF00E5FF);
}

class ClayShadows {
  const ClayShadows._();

  /// Inflated "inflated clay" drop: two stacked soft layers.
  static List<BoxShadow> raised(Color base) => [
        BoxShadow(
          color: base.withValues(alpha: 0.22),
          blurRadius: 24,
          offset: const Offset(0, 10),
          spreadRadius: -4,
        ),
        BoxShadow(
          color: base.withValues(alpha: 0.12),
          blurRadius: 48,
          offset: const Offset(0, 20),
          spreadRadius: -8,
        ),
      ];

  static const double radius = 28;
}

class ClayTheme {
  ClayTheme._();

  static ThemeData build(AccessibilityController a11y) {
    final highContrast = a11y.highContrast;

    final colorScheme = highContrast
        ? ColorScheme.dark(
            surface: ClayPalette.hcSurface,
            primary: ClayPalette.hcPrimary,
            secondary: ClayPalette.hcAccent,
            onSurface: ClayPalette.hcInk,
            onPrimary: Colors.black,
          )
        : ColorScheme.light(
            surface: ClayPalette.surface,
            primary: ClayPalette.primary,
            secondary: ClayPalette.accent,
            onSurface: ClayPalette.ink,
            onPrimary: Colors.white,
          );

    final bodyColor = highContrast ? ClayPalette.hcInk : ClayPalette.ink;

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      // Cairo ships on most Android builds; falls back to the system Arabic
      // font (Noto Naskh) gracefully — no CDN dependency, offline-safe.
      fontFamily: 'Cairo',
      textTheme: TextTheme(
        bodyLarge: TextStyle(color: bodyColor, height: 1.5),
        bodyMedium: TextStyle(color: bodyColor, height: 1.5),
        titleLarge: TextStyle(
          color: bodyColor,
          fontWeight: FontWeight.w700,
          height: 1.4,
        ),
        titleMedium: TextStyle(
          color: bodyColor,
          fontWeight: FontWeight.w600,
          height: 1.4,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surface,
        foregroundColor: bodyColor,
        elevation: 0,
        centerTitle: true,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(56, 56), // WCAG 2.5.8 target size (56dp+)
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ClayShadows.radius),
          ),
          elevation: 0,
          backgroundColor: colorScheme.primary,
          foregroundColor: colorScheme.onPrimary,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(56, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ClayShadows.radius),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: highContrast ? Colors.black : ClayPalette.surfaceHigh,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      cardTheme: CardThemeData(
        color: highContrast ? Colors.black : Colors.white.withValues(alpha: 0.7),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ClayShadows.radius),
        ),
        margin: EdgeInsets.zero,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}
