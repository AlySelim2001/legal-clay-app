// Deadline calculator screen — renders ONLY dual-verified results.
//
// Mirrors the Kotlin engine's contract exactly: a DualCheckFailed result
// shows an error, never a date. Every channel displays the pending-legal-
// review badge until counsel signs off.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import '../../domain/legal/egyptian_deadline_calculator.dart';
import '../accessibility/a11y_banner.dart';
import '../main_container.dart';

class DeadlinesPage extends StatefulWidget {
  const DeadlinesPage({super.key});

  @override
  State<DeadlinesPage> createState() => _DeadlinesPageState();
}

class _DeadlinesPageState extends State<DeadlinesPage> {
  LegalDeadlineChannel _channel = LegalDeadlineChannel.opposition;
  DateTime _startDate = DateTime.now();
  DeadlineResult? _result;

  static const _urgencyColors = <int, Color>{
    // mirror of UrgencyColors tokens
    0: Color(0xFFC0392B), // critical ≤ 3
    1: Color(0xFFF1C40F), // high ≤ 7
    2: Color(0xFF27AE60), // normal
  };

  Color _urgencyColor(int daysRemaining) {
    if (daysRemaining <= 3) return _urgencyColors[0]!;
    if (daysRemaining <= 7) return _urgencyColors[1]!;
    return _urgencyColors[2]!;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(1990),
      lastDate: DateTime.now(),
      locale: const Locale('ar'),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked;
        _result = null;
      });
    }
  }

  void _compute() {
    final container = context.read<AppContainer>();
    setState(() {
      _result = container.calculator.compute(_channel, _startDate);
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dateFormat = DateFormat('yyyy/MM/dd', 'ar');

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('حاسبة المواعيد القانونية',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          DropdownButtonFormField<LegalDeadlineChannel>(
            value: _channel,
            decoration: const InputDecoration(labelText: 'نوع الطعن'),
            items: LegalDeadlineChannel.values
                .map((c) => DropdownMenuItem(
                      value: c,
                      child: Text('${c.titleAr} — ${c.windowDays} يوماً'),
                    ))
                .toList(),
            onChanged: (c) => setState(() {
              _channel = c ?? _channel;
              _result = null;
            }),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(20),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'تاريخ الإخطار / الحكم',
                suffixIcon: Icon(Icons.calendar_month),
              ),
              child: Text(dateFormat.format(_startDate)),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _compute,
            icon: const Icon(Icons.calculate),
            label: const Text('احسب الميعاد'),
          ),
          const SizedBox(height: 16),
          if (_result is DeadlineVerified) ...[
            _buildVerified(context, _result! as DeadlineVerified, dateFormat),
          ] else if (_result is DeadlineDualCheckFailed)
            Card(
              color: scheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline, size: 40),
                    const SizedBox(height: 8),
                    Text(
                      'فشل التحقق المزدوج — لا يمكن عرض تاريخ. '
                      'راجع المحامي المسؤول فوراً.',
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            )
          else if (_result is DeadlineInvalid)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text((_result! as DeadlineInvalid).reasonAr),
              ),
            ),
          const SizedBox(height: 16),
          const A11yBanner.polite(LegalText.reviewPendingAr),
        ],
      ),
    );
  }

  Widget _buildVerified(
    BuildContext context,
    DeadlineVerified v,
    DateFormat dateFormat,
  ) {
    final scheme = Theme.of(context).colorScheme;
    final color = _urgencyColor(v.daysRemaining);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.verified, color: scheme.secondary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'ميعاد ${v.channel.titleAr}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              dateFormat.format(v.deadline),
              style: Theme.of(context).textTheme.headlineMedium,
              textAlign: TextAlign.center,
            ),
            if (v.wasRolled) ...[
              const SizedBox(height: 4),
              Text(
                'الميعاد الأصلي ${dateFormat.format(v.rawDeadline)} وقع في '
                'عطلة الجمعة/السبت — مُدّ إلى يوم العمل التالي.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: color),
              ),
              child: Text(
                'المتبقي ${v.daysRemaining} يوماً',
                textAlign: TextAlign.center,
                style: TextStyle(color: color, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.gavel, size: 16, color: scheme.error),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    LegalText.reviewPendingAr,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
