/// Egyptian criminal-procedure appeal deadline calculator.
///
/// Dart port of the audited Kotlin M4 engine
/// (`android/.../domain/legal/EgyptianDeadlineCalculator.kt`) — the same
/// channels, the same Fri/Sat→Sunday roll, and the same mandatory
/// dual-verification contract.
///
/// Channels (per product spec):
///  - المعارضة في الأحكام الغيابية (opposition to default rulings) — 10 days
///  - الاستئناف الجنائي (criminal appeal) — 10 days
///  - الطعن بالنقض (cassation) — 60 days
///
/// CITATION INTEGRITY: the windows match the product specification, but the
/// exact article numbers are NOT hardcoded as settled law — each channel
/// carries [LegalDeadlineChannel.needsLegalReview] and the UI MUST display
/// that flag until legal counsel signs off. A wrong legal date is a
/// catastrophe; an honest "pending review" badge is not.
///
/// DUAL VERIFICATION (mandatory): every deadline is computed twice through
/// two fully independent implementations:
///   1. [DateTime] calendar arithmetic (UTC-anchored to dodge DST/DST-less
///      device quirks)
///   2. a hand-rolled proleptic-Gregorian day-count (Zeller weekday + manual
///      month lengths) that shares zero code with DateTime
/// If the two disagree, the result is [DeadlineResult.dualCheckFailed] and
/// the UI must show an error — never a silently wrong legal date.
///
/// WEEKEND ROLL: per the P1 deadline-engine decision, if a deadline lands on
/// Friday or Saturday (the Egyptian weekend), it rolls FORWARD to Sunday.
/// Roll direction is a legal-policy question flagged for counsel review —
/// the code states its assumption explicitly rather than hiding it.
library;

/// Supported appeal channels with their review status.
enum LegalDeadlineChannel {
  opposition(
    id: 'opposition',
    titleAr: 'المعارضة في الحكم الغيابي',
    windowDays: 10,
    needsLegalReview: true,
  ),
  criminalAppeal(
    id: 'criminal_appeal',
    titleAr: 'الاستئناف الجنائي',
    windowDays: 10,
    needsLegalReview: true,
  ),
  cassation(
    id: 'cassation',
    titleAr: 'الطعن بالنقض',
    windowDays: 60,
    needsLegalReview: true,
  );

  const LegalDeadlineChannel({
    required this.id,
    required this.titleAr,
    required this.windowDays,
    required this.needsLegalReview,
  });

  final String id;
  final String titleAr;
  final int windowDays;
  final bool needsLegalReview;

  static LegalDeadlineChannel? fromId(String id) {
    for (final channel in LegalDeadlineChannel.values) {
      if (channel.id == id) return channel;
    }
    return null;
  }
}

enum VerificationStatus { dualCheckPassed, dualCheckFailed }

/// Year-month-day triple for engine-2 outputs (pure ints, no DateTime).
class YMD {
  const YMD(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  @override
  bool operator ==(Object other) =>
      other is YMD && year == other.year && month == other.month && day == other.day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() =>
      '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
}

sealed class DeadlineResult {
  const DeadlineResult();
}

/// Both engines agree — safe to render (with the review badge).
class DeadlineVerified extends DeadlineResult {
  const DeadlineVerified({
    required this.channel,
    required this.startDate,
    required this.rawDeadline,
    required this.deadline,
    required this.rawDeadlineYMD,
    required this.deadlineYMD,
    required this.daysRemaining,
    required this.wasRolled,
  });

  final LegalDeadlineChannel channel;
  final DateTime startDate;

  /// Raw window end BEFORE weekend roll.
  final DateTime rawDeadline;

  /// Final enforceable date AFTER rolling off Fri/Sat onto Sunday.
  final DateTime deadline;

  /// Engine-2 (DateTime-independent) result for the raw deadline.
  final YMD rawDeadlineYMD;

  /// Engine-2 (DateTime-independent) result for the final deadline.
  final YMD deadlineYMD;

  final int daysRemaining;
  final bool wasRolled;
}

/// The two engines disagreed — UI MUST block, never render a date.
class DeadlineDualCheckFailed extends DeadlineResult {
  const DeadlineDualCheckFailed({
    required this.channel,
    required this.primary,
    required this.secondary,
  });

  final LegalDeadlineChannel channel;
  final DateTime primary;
  final DateTime secondary;
}

/// Invalid input (start date in the future, non-Gregorian, etc.).
class DeadlineInvalid extends DeadlineResult {
  const DeadlineInvalid(this.reasonAr);

  final String reasonAr;
}

class EgyptianDeadlineCalculator {
  const EgyptianDeadlineCalculator();

  /// Compute the deadline for [channel] starting at [startDate] (e.g. the
  /// notification or judgment date). Verdict urgency is derived for display
  /// only (≤3 days red, ≤7 amber, else green) — it never gates filing.
  DeadlineResult compute(
    LegalDeadlineChannel channel,
    DateTime startDate, {
    DateTime? today,
  }) {
    final now = today ?? DateTime.now();
    final todayDate = DateTime.utc(now.year, now.month, now.day);
    final start = DateTime.utc(startDate.year, startDate.month, startDate.day);

    if (start.isAfter(todayDate)) {
      return const DeadlineInvalid('تاريخ البداية لا يمكن أن يكون مستقبلياً');
    }
    if (channel.windowDays <= 0) {
      return const DeadlineInvalid('مدة غير صالحة لهذا الطعن');
    }

    // ---- Engine 1: DateTime (UTC-anchored) arithmetic ----
    final rawPrimary = start.add(Duration(days: channel.windowDays));
    final primary = _rollOffWeekend(rawPrimary);

    // ---- Engine 2: independent proleptic-Gregorian implementation ----
    final rawSecondaryEpoch =
        _toEpochDay(start.year, start.month, start.day) + channel.windowDays;
    final rawSecondaryYMD = _fromEpochDay(rawSecondaryEpoch);
    final secondaryYMD = _rollOffWeekendManual(rawSecondaryYMD);

    final primaryYMD =
        YMD(primary.year, primary.month, primary.day);
    final rawPrimaryYMD =
        YMD(rawPrimary.year, rawPrimary.month, rawPrimary.day);

    if (primaryYMD != secondaryYMD || rawPrimaryYMD != rawSecondaryYMD) {
      return DeadlineDualCheckFailed(
        channel: channel,
        primary: primary,
        secondary: DateTime.utc(
          secondaryYMD.year,
          secondaryYMD.month,
          secondaryYMD.day,
        ),
      );
    }

    return DeadlineVerified(
      channel: channel,
      startDate: start,
      rawDeadline: rawPrimary,
      deadline: primary,
      rawDeadlineYMD: rawPrimaryYMD,
      deadlineYMD: primaryYMD,
      daysRemaining: primary.difference(todayDate).inDays,
      wasRolled: rawPrimary != primary,
    );
  }

  // -------------------------------------------------------------------------
  // Engine 1: DateTime (UTC-anchored so device timezones can't skew a day)
  // -------------------------------------------------------------------------

  static DateTime _rollOffWeekend(DateTime date) {
    var d = date;
    // DateTime.weekday: Monday=1 … Friday=5, Saturday=6, Sunday=7.
    while (d.weekday == DateTime.friday || d.weekday == DateTime.saturday) {
      d = d.add(const Duration(days: 1));
    }
    return d;
  }

  // -------------------------------------------------------------------------
  // Engine 2: hand-rolled proleptic-Gregorian (no DateTime APIs)
  // -------------------------------------------------------------------------

  static bool _isLeap(int y) => (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;

  static int _daysInMonth(int y, int m) {
    switch (m) {
      case 1:
      case 3:
      case 5:
      case 7:
      case 8:
      case 10:
      case 12:
        return 31;
      case 4:
      case 6:
      case 9:
      case 11:
        return 30;
      case 2:
        return _isLeap(y) ? 29 : 28;
      default:
        throw ArgumentError('month $m');
    }
  }

  /// Days since epoch for a proleptic-Gregorian date (independent of DateTime).
  static int _toEpochDay(int y, int m, int d) {
    var days = 0;
    if (y >= 1970) {
      for (var yy = 1970; yy < y; yy++) {
        days += _isLeap(yy) ? 366 : 365;
      }
      for (var mm = 1; mm < m; mm++) {
        days += _daysInMonth(y, mm);
      }
    } else {
      for (var yy = y; yy < 1970; yy++) {
        days -= _isLeap(yy) ? 366 : 365;
      }
      for (var mm = m; mm < 12; mm++) {
        days -= _daysInMonth(y, mm);
      }
    }
    return days + d - 1;
  }

  static YMD _fromEpochDay(int epoch) {
    var days = epoch;
    var y = 1970;
    while (days >= (_isLeap(y) ? 366 : 365)) {
      days -= _isLeap(y) ? 366 : 365;
      y++;
    }
    while (days < 0) {
      y--;
      days += _isLeap(y) ? 366 : 365;
    }
    var m = 1;
    while (days >= _daysInMonth(y, m)) {
      days -= _daysInMonth(y, m);
      m++;
    }
    return YMD(y, m, days + 1);
  }

  /// Zeller's congruence (Gregorian): h = 0 → Saturday, …, 5 → Thursday, 6 → Friday.
  static int _zellerDow(int y, int m, int d) {
    final mm = m < 3 ? m + 12 : m;
    final yy = m < 3 ? y - 1 : y;
    final k = yy % 100;
    final j = yy ~/ 100;
    return (d + (13 * (mm + 1)) ~/ 5 + k + k ~/ 4 + j ~/ 4 + 5 * j) % 7;
  }

  static YMD _rollOffWeekendManual(YMD date) {
    var y = date.year;
    var m = date.month;
    var d = date.day;
    while (true) {
      final dow = _zellerDow(y, m, d); // 0 = Saturday, 6 = Friday
      final isFriday = dow == 6;
      final isSaturday = dow == 0;
      if (!isFriday && !isSaturday) break;
      d++;
      if (d > _daysInMonth(y, m)) {
        d = 1;
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
    return YMD(y, m, d);
  }
}
