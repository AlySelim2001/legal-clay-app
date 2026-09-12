import 'package:flutter_test/flutter_test.dart';
import 'package:legal_clay/domain/legal/egyptian_deadline_calculator.dart';

/// Unit tests for the dual-verification deadline calculator — the Dart port
/// of `EgyptianDeadlineCalculatorTest.kt`. All dates are pinned so the suite
/// is deterministic; `daysRemaining` is the only now-derived field.
void main() {
  const calc = EgyptianDeadlineCalculator();
  final today = DateTime.utc(2026, 1, 1);

  // ------------------------------------------------------------------
  // Channel metadata — citation integrity policy
  // ------------------------------------------------------------------
  test('all channels are flagged as needing legal review', () {
    // A wrong legal date is a catastrophe; the badge must ship ON until
    // counsel signs off. If this test fails, counsel signed off — update
    // the flag AND the cited articles together.
    for (final channel in LegalDeadlineChannel.values) {
      expect(channel.needsLegalReview, isTrue);
    }
  });

  test('channel lookup by id round-trips', () {
    for (final channel in LegalDeadlineChannel.values) {
      expect(LegalDeadlineChannel.fromId(channel.id), channel);
    }
    expect(LegalDeadlineChannel.fromId('nope'), isNull);
  });

  // ------------------------------------------------------------------
  // Weekend roll (Fri/Sat → Sunday), verified against reference dates
  // ------------------------------------------------------------------
  test('opposition window landing on Friday rolls to Sunday', () {
    // 2026-09-01 + 10d = 2026-09-11 (Friday) → rolls to 2026-09-13.
    final r = calc.compute(
      LegalDeadlineChannel.opposition,
      DateTime.utc(2026, 9, 1),
      today: today,
    );
    expect(r, isA<DeadlineVerified>());
    final v = r as DeadlineVerified;
    expect(v.rawDeadline, DateTime.utc(2026, 9, 11));
    expect(v.deadline, DateTime.utc(2026, 9, 13));
    expect(v.wasRolled, isTrue);
  });

  test('cassation window landing on a weekday is not rolled', () {
    // 2026-09-03 + 60d = 2026-11-02 (Monday) → unchanged.
    final r = calc.compute(
      LegalDeadlineChannel.cassation,
      DateTime.utc(2026, 9, 3),
      today: today,
    );
    expect(r, isA<DeadlineVerified>());
    final v = r as DeadlineVerified;
    expect(v.deadline, DateTime.utc(2026, 11, 2));
    expect(v.wasRolled, isFalse);
  });

  test('roll across a month boundary lands on the first of next month', () {
    // 2026-10-21 + 10d = 2026-10-31 (Saturday) → rolls to 2026-11-01.
    final r = calc.compute(
      LegalDeadlineChannel.opposition,
      DateTime.utc(2026, 10, 21),
      today: today,
    );
    expect(r, isA<DeadlineVerified>());
    final v = r as DeadlineVerified;
    expect(v.rawDeadline, DateTime.utc(2026, 10, 31));
    expect(v.deadline, DateTime.utc(2026, 11, 1));
    expect(v.wasRolled, isTrue);
  });

  test('deadline on Saturday rolls exactly one day', () {
    // 2026-10-28 + 10d = 2026-11-07 (Saturday) → rolls to 2026-11-08.
    final r = calc.compute(
      LegalDeadlineChannel.opposition,
      DateTime.utc(2026, 10, 28),
      today: today,
    );
    expect(r, isA<DeadlineVerified>());
    final v = r as DeadlineVerified;
    expect(v.deadline, DateTime.utc(2026, 11, 8));
    expect(v.wasRolled, isTrue);
  });

  // ------------------------------------------------------------------
  // Leap-year arithmetic through both engines
  // ------------------------------------------------------------------
  test('window ending on a leap day is computed consistently', () {
    // 2028-02-19 + 10d = 2028-02-29 (Tuesday) → no roll needed.
    final r = calc.compute(
      LegalDeadlineChannel.opposition,
      DateTime.utc(2028, 2, 19),
      today: today,
    );
    expect(r, isA<DeadlineVerified>());
    final v = r as DeadlineVerified;
    expect(v.deadline, DateTime.utc(2028, 2, 29));
    expect(v.wasRolled, isFalse);
  });

  // ------------------------------------------------------------------
  // Input validation
  // ------------------------------------------------------------------
  test('future start date is rejected', () {
    final r = calc.compute(
      LegalDeadlineChannel.cassation,
      DateTime.utc(2026, 1, 2),
      today: today,
    );
    expect(r, isA<DeadlineInvalid>());
  });

  // ------------------------------------------------------------------
  // Dual verification contract
  // ------------------------------------------------------------------
  test('both engines agree on a sweep of start dates', () {
    // Every result must be Verified — a sweep across month and leap
    // boundaries exercises both independent implementations.
    const starts = [
      (2025, 12, 20), (2026, 2, 20), (2026, 9, 1),
      (2027, 12, 25), (2028, 2, 19), (2028, 12, 30),
    ];
    for (final (y, m, d) in starts) {
      for (final channel in LegalDeadlineChannel.values) {
        final r = calc.compute(
          channel,
          DateTime.utc(y, m, d),
          today: today,
        );
        expect(r, isA<DeadlineVerified>(),
            reason: 'engine disagreement at $y-$m-$d/${channel.id}');
      }
    }
  });

  test('engine-2 YMD mirrors the DateTime deadline exactly', () {
    final r = calc.compute(
      LegalDeadlineChannel.cassation,
      DateTime.utc(2026, 9, 3),
      today: today,
    );
    final v = r as DeadlineVerified;
    expect(v.deadlineYMD.year, v.deadline.year);
    expect(v.deadlineYMD.month, v.deadline.month);
    expect(v.deadlineYMD.day, v.deadline.day);
    expect(v.rawDeadlineYMD.year, v.rawDeadline.year);
    expect(v.rawDeadlineYMD.month, v.rawDeadline.month);
    expect(v.rawDeadlineYMD.day, v.rawDeadline.day);
  });

  test('daysRemaining is measured from the anchored today', () {
    final r = calc.compute(
      LegalDeadlineChannel.opposition,
      DateTime.utc(2026, 9, 1),
      today: DateTime.utc(2026, 9, 5),
    );
    final v = r as DeadlineVerified;
    // 2026-09-05 → deadline 2026-09-13 = 8 days.
    expect(v.daysRemaining, 8);
  });
}
