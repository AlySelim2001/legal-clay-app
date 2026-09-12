// One-Tap Emergency Mode — the inclusive entry point for distressed users.
//
// Three massive buttons (≥ 112dp), each announcing a spoken Arabic
// explanation on long-press so low-literacy users can navigate by ear. The
// "urgent steps" sheet reads the verified procedural walkthrough aloud
// (matching the web frontend's EmergencyMode contract).

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import '../accessibility/a11y_banner.dart';
import '../theme/clay_theme.dart';
import '../voice/voice_gateway.dart';

class EmergencyPage extends StatelessWidget {
  const EmergencyPage({super.key, required this.onNavigate});

  /// Switches the shell's bottom-nav tab (0..4). Passed in by [HomeShell]
  /// instead of pushing placeholder routes — navigation stays honest.
  final void Function(int tabIndex) onNavigate;

  static const List<String> urgentStepsAr = <String>[
    'لا توقّع أي ورقة ولا تسلّم أي أصل قبل استشارة محامٍ.',
    'احتفظ بالأصل في مكان آمن واصوّر كل مستند وصلك.',
    'الطعن بالتزوير إجراء مستقل: قدّمه في الجهة المختصة مع المستند الأصل.',
    'لا تعتمد على المدد المذكورة هنا قبل مراجعة المحامي المسؤول — '
        'راجع القنوات الرسمية دائماً.',
  ];

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final voice = context.read<VoiceGateway>();

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'الاستغاثة السريعة',
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            'اضغط مطولاً على أي زر لتسمع شرحه صوتياً',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          _EmergencyButton(
            icon: Icons.document_scanner,
            label: 'صوّر الإيصال',
            description: 'مسح مستند وفحصه بوضوح وبدقة',
            color: ClayPalette.urgencyNormal,
            onTap: () => onNavigate(1),
            onLongPress: () => _speak(
              context,
              voice,
              'اضغط مرة واحدة لتصوير الإيصال أو المحضر، وسيقرأ التطبيق النص '
                  'ويساعدك على فهمه.',
            ),
          ),
          const SizedBox(height: 16),
          _EmergencyButton(
            icon: Icons.mic,
            label: 'احكي مشكلتك',
            description: 'تحدّث بالصوت وسيفهمك المساعد',
            color: scheme.secondary,
            onTap: () => onNavigate(2),
            onLongPress: () => _speak(
              context,
              voice,
              'اضغط مرة واحدة لتتحدث بصوتك وتسأل عن مشكلتك القانونية '
                  'بالعامية المصرية.',
            ),
          ),
          const SizedBox(height: 16),
          _EmergencyButton(
            icon: Icons.gavel,
            label: 'خطوات الطعن السريع',
            description: 'دليل مسموع للحاجة العاجلة',
            color: ClayPalette.urgencyCritical,
            onTap: () => _showSteps(context, voice),
            onLongPress: () => _speak(
              context,
              voice,
              'اضغط مرة واحدة لعرض وقراءة الخطوات العاجلة التي يجب عليك '
                  'اتباعها الآن.',
            ),
          ),
          const SizedBox(height: 24),
          const A11yBanner.polite(LegalText.disclaimerAr),
          const SizedBox(height: 8),
          const A11yBanner.polite(LegalText.privacyAr),
        ],
      ),
    );
  }

  void _speak(BuildContext context, VoiceGateway voice, String text) {
    voice.speak(text);
    announceForScreenReader(context, text, assertive: true);
  }

  void _showSteps(BuildContext context, VoiceGateway voice) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Text('الخطوات العاجلة',
                style: Theme.of(sheetContext).textTheme.titleLarge),
            const SizedBox(height: 12),
            ...urgentStepsAr.map(
              (s) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.arrow_left, size: 22),
                    const SizedBox(width: 4),
                    Expanded(child: Text(s)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () {
                voice.speak(urgentStepsAr.join(' '));
                Navigator.of(sheetContext).pop();
              },
              icon: const Icon(Icons.volume_up),
              label: const Text('اسمع الخطوات'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmergencyButton extends StatelessWidget {
  const _EmergencyButton({
    required this.icon,
    required this.label,
    required this.description,
    required this.color,
    required this.onTap,
    required this.onLongPress,
  });

  final IconData icon;
  final String label;
  final String description;
  final Color color;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final hc = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      button: true,
      label: '$label. $description',
      child: Material(
        color: hc ? Colors.black : Colors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(ClayShadows.radius),
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          borderRadius: BorderRadius.circular(ClayShadows.radius),
          child: Container(
            constraints: const BoxConstraints(minHeight: 112),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(ClayShadows.radius),
              border: Border.all(color: color, width: 2),
            ),
            child: Row(
              children: [
                Icon(icon, size: 40, color: color),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(description,
                          style: Theme.of(context).textTheme.bodyMedium),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
