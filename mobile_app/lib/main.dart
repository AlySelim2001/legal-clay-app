// Legal Clay App — entry point & composition root.
//
// Arabic-first RTL Flutter client for the Zero-Trust legal stack:
//  - SQLCipher encrypted database (key lives in Android Keystore)
//  - HTTPS-only release networking with fail-closed TLS pinning
//  - Dual-verified Egyptian deadline engine (never renders an unverified date)
//  - WCAG-oriented accessibility: 200% font scaling, high contrast, TTS/STT
//
// State management is `provider` (ChangeNotifier + ProviderScope pattern);
// no bloc dependency is required by the current architecture.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
// Loads the bundled date symbols so DateFormat('…', 'ar') works offline.
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'data/backend/backend_client.dart';
import 'data/local/app_database.dart';
import 'data/local/db_key_manager.dart';
import 'domain/legal/egyptian_deadline_calculator.dart';
import 'presentation/a11y/accessibility_controller.dart';
import 'presentation/home_shell.dart';
import 'presentation/theme/clay_theme.dart';
import 'presentation/voice/voice_gateway.dart';

/// Composition root — one instance, created in main(), exposed to the widget
/// tree via [Provider]. Pages read it with `context.read<AppContainer>()`.
class AppContainer {
  AppContainer() {
    database = AppDatabase(keyManager: keyManager);
  }

  final BackendClient backend = BackendClient();
  final EgyptianDeadlineCalculator calculator =
      const EgyptianDeadlineCalculator();
  final DbKeyManager keyManager = DbKeyManager();

  /// Assigned in the constructor so the DB and the key manager share one
  /// lifecycle (a Keystore failure surfaces as StorageError — fail-closed).
  late final AppDatabase database;
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar');
  // Initialize SQLCipher encrypted database & hardware-backed key storage.
  // The key manager is lazily invoked on first DB access; a Keystore failure
  // propagates as StorageError (fail-closed — no plaintext fallback).
  final container = AppContainer();

  runApp(
    MultiProvider(
      providers: [
        Provider<AppContainer>.value(value: container),
        Provider<VoiceGateway>(create: (_) => FlutterTtsGateway()),
        ChangeNotifierProvider<AccessibilityController>(
          create: (_) => AccessibilityController(),
        ),
      ],
      child: const LegalClayApp(),
    ),
  );
}

class LegalClayApp extends StatelessWidget {
  const LegalClayApp({super.key});

  /// Static so the dark variant exists once; it only feeds the theme builder.
  static final AccessibilityController _highContrastController =
      AccessibilityController()..highContrast = true;

  @override
  Widget build(BuildContext context) {
    final a11y = context.watch<AccessibilityController>();
    return MaterialApp(
      title: 'الدرع القانوني - Legal Clay',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar', 'EG'),
      supportedLocales: const [Locale('ar', 'EG'), Locale('en', 'US')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ClayTheme.build(a11y),
      darkTheme: ClayTheme.build(_highContrastController),
      // The accessibility toggle flips the ACTIVE theme to black/yellow AAA
      // via ClayTheme.build; system dark mode maps to the same variant.
      themeMode: ThemeMode.light,
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(a11y.fontScale.value)),
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      home: const HomeShell(),
    );
  }
}
