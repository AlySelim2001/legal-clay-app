import 'package:flutter/material.dart';

import '../../../core/clay_palette.dart';
import '../../../domain/legal/egyptian_deadline_calculator.dart';

/// Legal deadline calculator UI. Every result carries the dual-verification
/// status and the "pending legal review" badge — a possibly-wrong legal date
/// is never rendered; a DualCheckFailed result blocks the display entirely.
class DeadlinesScreen extends StatefulWidget {
  const DeadlinesScreen({super.key, this.initialChannel});

  final LegalDeadlineChannel? initialChannel;

  @override
  State<DeadlinesScreen> createState() => _DeadlinesScreenState();
}

class _DeadlinesScreenState extends State<DeadlinesScreen> {
  final EgyptianDeadlineCalculator _calc = const EgyptianDeadlineCalculator();

  LegalDeadlineChannel _channel = LegalDeadlineChannel.opposition;
  DateTime _startDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    if (widget.initialChannel != null) _channel = widget.initialChannel!;
  }

  DeadlineResult? get _result =>
      _calc.compute(_channel, _startDate);

  static const List<LegalDeadlineChannel> _channels =
      LegalDeadlineChannel.values;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final result = _result;
    return Scaffold(
      appBar: AppBar(title: const Text('حاسبة المواعيد القانونية')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'نوع الطعن',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (final channel in _channels)
                          ChoiceChip(
                            label: Text(channel.titleAr),
                            selected: _channel == channel,
                            onSelected: (_) =>
                                setState(() => _channel = channel),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Icon(Icons.event),
                        const SizedBox(width: 8),
                        Expanded(
                          child: InkWell(
                            onTap: () => _pickDate(context),
                            child: InputDecorator(
                              decoration: const InputDecoration(
                                border: OutlineInputBorder(),
                                labelText: 'تاريخ الإخطار / الحكم',
                              ),
                              child: Text(_formatDate(_startDate)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (result == null)
              const SizedBox.shrink()
            else if (result is DeadlineInvalid)
              _InvalidCard(reasonAr: result.reasonAr)
            else if (result is DeadlineDualCheckFailed)
              const _DualCheckFailedCard()
            else if (result is DeadlineVerified)
              _VerifiedCard(result: result as DeadlineVerified),
            const SizedBox(height: 16),
            Text(
              'سياسة الدقة: محركان مستقلان (DateTime + عدّ يدوي) — عند أي '
              'اختلاف يُمنع عرض التاريخ إطلاقاً. جميع المواعيد بانتظار '
              'الاعتماد القانوني النهائي.',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(1990),
      // Past dates only: the engine rejects future start dates.
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _startDate = picked);
  }

  static String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _VerifiedCard extends StatelessWidget {
  const _VerifiedCard({required this.result});

  final DeadlineVerified result;

  @override
  Widget build(BuildContext context) {
    final urgency = urgencyForDaysRemaining(result.daysRemaining);
    final color = urgencyColor(urgency);
    final theme = Theme.of(context);
    return Card(
      color: color.withValues(alpha: 0.08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: color, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.verified, color: color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${result.channel.titleAr} — ${result.channel.windowDays} يوم',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _row('تاريخ البداية', _fmt(result.startDate)),
            _row(
              'الميعاد قبل التمرير',
              _fmt(result.rawDeadline),
            ),
            _row(
              'الميعاد النهائي',
              _fmt(result.deadline),
              emphasized: true,
            ),
            _row('الأيام المتبقية', '${result.daysRemaining}'),
            if (result.wasRolled)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'الميعاد سقط على الجمعة/السبت — أُزح إلى الأحد '
                  '(سياسة التمرير قيد الاعتماد).',
                  style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
                ),
              ),
            const SizedBox(height: 8),
            const _ReviewBadge(),
          ],
        ),
      ),
    );
  }

  static Widget _row(String label, String value, {bool emphasized = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            value,
            style: emphasized
                ? const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)
                : null,
          ),
        ],
      ),
    );
  }

  static String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _DualCheckFailedCard extends StatelessWidget {
  const _DualCheckFailedCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Clay.urgencyCritical.withValues(alpha: 0.08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: Clay.urgencyCritical, width: 1.5),
      ),
      child: const Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(Icons.error, color: Clay.urgencyCritical),
            SizedBox(height: 8),
            Text(
              'فشل التحقق المزدوج — لا يمكن عرض تاريخ موثوق. أعد المحاولة أو '
              'راجع المحامي فوراً.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _InvalidCard extends StatelessWidget {
  const _InvalidCard({required this.reasonAr});

  final String reasonAr;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.info_outline),
            const SizedBox(width: 8),
            Expanded(child: Text(reasonAr)),
          ],
        ),
      ),
    );
  }
}

class _ReviewBadge extends StatelessWidget {
  const _ReviewBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Clay.urgencyHigh.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Text(
        '⏳ بانتظار الاعتماد القانوني',
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }
}
