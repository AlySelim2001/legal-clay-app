// About — disclaimer + privacy statement (verbatim from LegalText).

import 'package:flutter/material.dart';

import '../../core/constants.dart';
import '../accessibility/a11y_banner.dart';

class AboutPage extends StatelessWidget {
  const AboutPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 8),
          Text(
            'Legal Clay',
            style: Theme.of(context).textTheme.headlineMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            'منظومة الحماية القانونية الرقمية — تعمل محلياً بالكامل',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          const A11yBanner.polite(LegalText.disclaimerAr),
          const SizedBox(height: 12),
          const A11yBanner.polite(LegalText.privacyAr),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('الخصوصية — لا نجمع شيئاً',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const Text(
                    'جميع بيانات القضايا تُخزَّن على هذا الجهاز فقط داخل قاعدة '
                    'بيانات مشفّرة بـ SQLCipher. مفتاح التشفير يُولَّد على '
                    'الجهاز ويُحفظ في Android Keystore — لا يترك جهازك أبداً. '
                    'لا يوجد أي تتبع أو تحليلات.',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('المستودع والدعم',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const Text('github.com/AlySelim2001/legal-clay-app'),
                  const SizedBox(height: 4),
                  const Text('النص الكامل: ملف DISCLAIMER.md في المستودع'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'الإصدار 1.0.0',
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
