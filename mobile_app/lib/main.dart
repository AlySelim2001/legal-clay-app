import 'package:flutter/material.dart';

import 'core/service_locator.dart';
import 'presentation/accessibility_controller.dart';
import 'presentation/clay_app.dart';
import 'presentation/screens/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ServiceLocator.init();
  runApp(ClayApp(
    accessibility: AccessibilityController(),
    home: const HomeScreen(),
  ));
}
