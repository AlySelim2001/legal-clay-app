// About — disclaimer + privacy statement (verbatim from LegalText),
// plus the accessibility settings (font scale, high contrast, spoken answers).

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import '../a11y/accessibility_controller.dart';
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
          const SizedBox(height: 12),
          const _A11ySettingsCard(),
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

/// Accessibility settings — the toggles that drive the clay theme's
/// high-contrast variant and the 200% font scaling.
class _A11ySettingsCard extends StatelessWidget {
  const _A11ySettingsCard();

  @override
  Widget build(BuildContext context) {
    final a11y = context.watch<AccessibilityController>();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('إعدادات الوصول الشامل',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final scale in FontScale.values)
                  ChoiceChip(
                    label: Text(scale.labelAr),
                    selected: a11y.fontScale == scale,
                    onSelected: (_) => a11y.fontScale = scale,
                  ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('التباين العالي (أسود/أصفر)'),
              subtitle: const Text('لضعاف البصر — نسبة تباين AAA'),
              value: a11y.highContrast,
              onChanged: (v) => a11y.highContrast = v,
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('قراءة الإجابات صوتياً'),
              subtitle: const Text('نطق الإجابات القانونية بالعامية'),
              value: a11y.spokenAnswers,
              onChanged: (v) => a11y.spokenAnswers = v,
            ),
          ],
        ),
      ),
    );
  }
}
