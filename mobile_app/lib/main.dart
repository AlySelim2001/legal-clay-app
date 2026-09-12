// Legal Clay App — entrypoint.
//
// RTL-native (Directionality.rtl), Arabic-first, rem-scaled typography
// (a11y controller drives MediaQuery.textScaler so 200% never breaks layout).

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'data/local/app_database.dart';
import 'data/local/db_key_manager.dart';
import 'data/backend/backend_client.dart';
import 'domain/legal/egyptian_deadline_calculator.dart';
import 'presentation/a11y/accessibility_controller.dart';
import 'presentation/home_shell.dart';
import 'presentation/theme/clay_theme.dart';
import 'presentation/voice/voice_gateway.dart';

/// Simple service locator — one container, explicit construction order
/// (no reflection, AOT-safe). The DB is lazy: opening it requires the
/// Keystore-backed key, which must never happen in a widget build.
class AppContainer {
  AppContainer();

  final DbKeyManager dbKeyManager = DbKeyManager();
  late final AppDatabase database = AppDatabase(keyManager: dbKeyManager);
  late final BackendClient backend = BackendClient();
  late final VoiceGateway voice = FlutterTtsGateway();
  const EgyptianDeadlineCalculator calculator = EgyptianDeadlineCalculator();
}

class LegalClayApp extends StatelessWidget {
  const LegalClayApp({super.key, this.container});

  final AppContainer? container;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AppContainer>.value(value: container ?? AppContainer()),
        Provider<VoiceGateway>.value(value: container?.voice ?? FlutterTtsGateway()),
        ChangeNotifierProvider<AccessibilityController>(
          create: (_) => AccessibilityController(),
        ),
      ],
      child: Consumer<AccessibilityController>(
        builder: (context, a11y, _) {
          final theme = ClayTheme.build(a11y);
          return MaterialApp(
            title: 'Legal Clay',
            debugShowCheckedModeBanner: false,
            theme: theme,
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
                    textScaler: TextScaler.linear(a11y.fontScale.value),
                  ),
                  child: child ?? const SizedBox.shrink(),
                ),
              );
            },
            home: const HomeShell(),
          );
        },
      ),
    );
  }
}

void main() {
  runApp(const LegalClayApp());
}
