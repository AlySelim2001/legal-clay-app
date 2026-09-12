import 'package:flutter/material.dart';

import '../../../core/service_locator.dart';
import '../../../core/clay_palette.dart';
import '../../../domain/legal/egyptian_deadline_calculator.dart';
import '../accessibility_controller.dart';
import 'deadlines_screen.dart';

/// Home shell — Arabic-first RTL with the accessibility sheet, a deadline
/// quick-check card, and the three emergency quick actions (scan, voice
/// complaint, urgent steps) sized as 56dp+ touch targets.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final AccessibilityController _accessibility = AccessibilityController();

  static const List<LegalDeadlineChannel> _channels =
      LegalDeadlineChannel.values;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('المظلة القانونية — Legal Clay'),
        actions: [
          IconButton(
            tooltip: 'إعدادات الوصول الشامل',
            icon: const Icon(Icons.accessibility_new),
            onPressed: _openAccessibilitySheet,
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              DrawerHeader(
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  borderRadius: const BorderRadius.only(
                    bottomStart: Radius.circular(24),
                    bottomEnd: Radius.circular(24),
                  ),
                ),
                child: const Align(
                  alignment: AlignmentDirectional.bottomStart,
                  child: Text(
                    'قضاياي',
                    style: TextStyle(color: Colors.white, fontSize: 22),
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.calculate_outlined),
                title: const Text('حاسبة المواعيد'),
                onTap: () => _push(const DeadlinesScreen()),
              ),
              const ListTile(
                leading: Icon(Icons.camera_alt_outlined),
                title: Text('صوّر المحضر (قريباً)'),
              ),
              const ListTile(
                leading: Icon(Icons.mic_none),
                title: Text('اشكِ بصوتك (قريباً)'),
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _QuickDeadlineCard(onOpen: () => _push(const DeadlinesScreen())),
            const SizedBox(height: 16),
            Text(
              'وضع الاستغاثة',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            _EmergencyAction(
              icon: Icons.camera_alt,
              label: 'صوّر الإيصال/المحضر',
              color: urgencyColor(Urgency.critical),
              onTap: () => _snack('فتح الكاميرا — قريباً'),
            ),
            const SizedBox(height: 10),
            _EmergencyAction(
              icon: Icons.mic,
              label: 'احكي مشكلتك بصوتك',
              color: urgencyColor(Urgency.high),
              onTap: () => _snack('التسجيل الصوتي — قريباً'),
            ),
            const SizedBox(height: 10),
            _EmergencyAction(
              icon: Icons.gavel,
              label: 'خطوات الطعن السريع',
              color: urgencyColor(Urgency.normal),
              onTap: () => _push(const DeadlinesScreen()),
            ),
            const SizedBox(height: 24),
            Text(
              'القنوات القانونية',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            ..._channels.map(
              (c) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  minLeadingWidth: 0,
                  leading: const Icon(Icons.timer_outlined),
                  title: Text(c.titleAr),
                  subtitle: Text('${c.windowDays} يوم'),
                  trailing: c.needsLegalReview
                      ? const _ReviewBadge()
                      : null,
                  onTap: () => _push(const DeadlinesScreen(initialChannel: c)),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              '⚠️ نتائج تقديرية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.',
              style: TextStyle(fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _push(Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  void _snack(String message) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

  void _openAccessibilitySheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => _AccessibilitySheet(controller: _accessibility),
    );
  }
}

class _QuickDeadlineCard extends StatelessWidget {
  const _QuickDeadlineCard({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.calendar_month, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'مواعيد الطعن القادمة',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(icon: const Icon(Icons.chevron_left), onPressed: onOpen),
              ],
            ),
            const Text(
              'احسب موعد المعارضة أو الاستئناف أو النقض بالتحقق المزدوج — '
              'لا يُعرض أي تاريخ قبل موافقة المحركين المستقلين.',
              style: TextStyle(fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmergencyAction extends StatelessWidget {
  const _EmergencyAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 72, // 56dp+ touch target per accessibility spec
      child: FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: color.withValues(alpha: 0.16),
          foregroundColor: color,
        ),
        onPressed: onTap,
        icon: Icon(icon, size: 28),
        label: Text(label, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

class _ReviewBadge extends StatelessWidget {
  const _ReviewBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Clay.urgencyHigh.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Text(
        'بانتظار الاعتماد القانوني',
        style: TextStyle(fontSize: 10),
      ),
    );
  }
}

class _AccessibilitySheet extends StatelessWidget {
  const _AccessibilitySheet({required this.controller});

  final AccessibilityController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('تكبير الخط', style: TextStyle(fontWeight: FontWeight.bold)),
              Slider(
                value: controller.fontScale,
                min: minFontScale,
                max: maxFontScale,
                divisions: 4,
                label: '${(controller.fontScale * 100).round()}%',
                onChanged: controller.setFontScale,
              ),
              const Text('نمط الوصول', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final mode in AccessMode.values)
                    ChoiceChip(
                      label: Text(_modeLabel(mode)),
                      selected: controller.mode == mode,
                      onSelected: (_) => controller.setMode(mode),
                    ),
                ],
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('الإرشاد الصوتي'),
                value: controller.voiceGuidance,
                onChanged: controller.setVoiceGuidance,
              ),
            ],
          ),
        );
      },
    );
  }

  static String _modeLabel(AccessMode mode) {
    switch (mode) {
      case AccessMode.standard:
        return 'عادي';
      case AccessMode.highContrast:
        return 'تباين عالٍ';
      case AccessMode.deuteranopia:
        return 'عمى الألوان الأخضر';
      case AccessMode.tritanopia:
        return 'عمى الألوان الأزرق';
    }
  }
}
