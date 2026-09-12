import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/clay_palette.dart';
import 'accessibility_controller.dart';

/// Builds the MaterialApp with the Claymorphism theme, Arabic-first RTL
/// direction, and the active accessibility mode applied.
class ClayApp extends StatelessWidget {
  ClayApp({
    super.key,
    required this.accessibility,
    required this.home,
  });

  final AccessibilityController accessibility;
  final Widget home;

  ThemeData _theme(AccessMode mode) {
    final accent = accessibleAccent(mode);
    final highContrast = mode == AccessMode.highContrast;
    final base = highContrast
        ? ThemeData(brightness: Brightness.dark, useMaterial3: true)
        : ThemeData(
            brightness: Brightness.light,
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: Clay.primary,
              primary: Clay.primary,
              surface: Clay.surface,
            ),
            scaffoldBackgroundColor: Clay.surface,
          );
    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(primary: accent),
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
        ),
      ),
      cardTheme: CardTheme(
        elevation: 8,
        shadowColor: Colors.black26,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Clay.radiusL),
        ),
        color: highContrast ? Colors.black : Colors.white,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Clay.radiusM),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: accessibility,
      builder: (context, _) {
        return MaterialApp(
          title: 'Legal Clay — محامي الجيب',
          debugShowCheckedModeBanner: false,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) {
            return Directionality(
              textDirection: TextDirection.rtl,
              child: MediaQuery(
                data: MediaQuery.of(context).copyWith(
                  textScaler: TextScaler.linear(accessibility.fontScale),
                ),
                child: child ?? const SizedBox.shrink(),
              ),
            );
          },
          theme: _theme(accessibility.mode),
          home: home,
        );
      },
    );
  }
}
