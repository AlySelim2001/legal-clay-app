// Legal Clay App — on-device Egyptian National ID (الرقم القومي) detector.
//
// Byte-parity Dart port of `local-ai/services/presidio-scrubber/egyptian_nid.py`
// (the Presidio recognizer). Same regex, same Luhn weights, same governorate
// table, same Arabic-Indic digit normalization, same scoring bands — so the
// mobile pre-scrub gate and the server-side fail-closed scrubber agree on
// what is PII. Local pre-scrubbing means a National ID never has to survive
// a network round-trip at all.
//
// The Egyptian NID is exactly 14 digits:
//   digit  1     -> century (2 = born 1900s, 3 = born 2000s)
//   digits 2-7   -> YYMMDD date of birth
//   digits 8-9   -> governorate code (01 Cairo .. 88 born abroad)
//   digits 10-13 -> birth serial
//   digit  14    -> checksum (Luhn check digit over the first 13)
//
// NOTE: the regex uses lookbehind/lookahead, supported by the Dart VM / AOT
// (this app targets Android native only — never compile to JS).

/// A detected PII span. Offsets index into the ORIGINAL input text
/// (Arabic-Indic normalization is a 1:1 per-code-unit translation, so offsets
/// stay valid — same guarantee as the Python recognizer).
class PiiFinding {
  const PiiFinding({
    required this.start,
    required this.end,
    required this.text,
    required this.score,
  });

  final int start;
  final int end;
  final String text;
  final double score;

  @override
  String toString() =>
      'PiiFinding(EG_NATIONAL_ID[$start:$end], score=$score)';
}

/// Redaction operator applied to each finding.
enum PiiRedaction {
  /// Replace with the fixed Arabic label (matches the server's REDACTION_LABEL).
  redact,

  /// Keep the last 4 digits, mask the rest — enough to spot duplicates,
  /// not enough to identify.
  mask,
}

class PiiScrubResult {
  const PiiScrubResult({
    required this.scrubbedText,
    required this.findings,
    required this.blocked,
  });

  /// Text safe to persist/emit. On [blocked] this is EMPTY (fail-closed).
  final String scrubbedText;
  final List<PiiFinding> findings;

  /// True when scrubbing itself failed — the caller MUST NOT emit the text.
  final bool blocked;
}

class PiiScrubber {
  const PiiScrubber();

  /// 14 digits: century(1) + YY(2) + MM(2) + DD(2) + governorate(2)
  /// + serial(4) + checksum(1). Boundaries ensure a 15-digit run is never
  /// partially matched — the same (verified) server behavior.
  static final RegExp _pattern = RegExp(
    r'(?<!\d)([23]\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])'
    r'(?:0[1-9]|[1-8][0-9]|88)\d{5})(?!\d)',
  );

  /// Egyptian governorate codes (NID digits 8-9): 01-35 allocated + 88 =
  /// born abroad. Over-inclusion is harmless (the Luhn checksum still filters
  /// randoms) while excluding real codes like 01 (Cairo) would leak PII.
  static const Set<String> _govCodes = {
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
    '31', '32', '33', '34', '35', '88',
  };

  static const List<String> _contextWords = [
    'رقم قومي',
    'الرقم القومي',
    'بطاقة رقمية',
    'بطاقة الرقم القومي',
    'national id',
    'national number',
  ];

  static const List<int> _luhnWeights = [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];

  /// What the server's anonymizer replaces NIDs with.
  static const String redactionLabel = '<رقم_قومي_محجوب>';

  /// Normalize Arabic-Indic (U+0660-0669) and Extended Arabic-Indic
  /// (U+06F0-06F9) digits to ASCII. Both blocks are single UTF-16 code units,
  /// so the per-code-unit mapping preserves offsets against the original.
  static String normalizeDigits(String text) {
    final units = text.codeUnits;
    final out = <int>[];
    for (final u in units) {
      if (u >= 0x0660 && u <= 0x0669) {
        out.add(0x30 + (u - 0x0660)); // '0'..'9'
      } else if (u >= 0x06F0 && u <= 0x06F9) {
        out.add(0x30 + (u - 0x06F0));
      } else {
        out.add(u);
      }
    }
    return String.fromCharCodes(out);
  }

  /// Validate the 14th digit (Luhn variant used by the Egyptian NID).
  static bool luhnChecksumOk(String nid) {
    var total = 0;
    for (var i = 0; i < 13; i++) {
      final p = int.parse(nid[i]) * _luhnWeights[i];
      total += p ~/ 10 + p % 10;
    }
    return (10 - total % 10) % 10 == int.parse(nid[13]);
  }

  static bool _birthDateOk(String nid) {
    // Regex already constrains MM (01-12) and DD (01-31); mirror the
    // recognizer's check for defense in depth.
    final mm = nid.substring(3, 5);
    final dd = int.parse(nid.substring(5, 7));
    final mmInt = int.parse(mm);
    if (mmInt < 1 || mmInt > 12) return false;
    if (dd < 1 || dd > 31) return false;
    return true;
  }

  /// All National-ID findings in [text], deduplicated (overlaps keep the
  /// highest score, ties go to the earliest span — matches the recognizer).
  List<PiiFinding> findNationalIds(String text) {
    final normalized = normalizeDigits(text);
    final results = <PiiFinding>[];
    for (final match in _pattern.allMatches(normalized)) {
      final nid = match.group(1)!;
      final score = _score(nid, normalized, match.start);
      if (score == null) continue;
      results.add(
        PiiFinding(
          start: match.start,
          end: match.end,
          text: nid,
          score: score,
        ),
      );
    }
    return _removeDuplicates(results);
  }

  double? _score(String nid, String normalizedText, int offset) {
    if (!_birthDateOk(nid)) return null;
    final gov = nid.substring(7, 9);
    if (!_govCodes.contains(gov)) return null;

    double score;
    if (luhnChecksumOk(nid)) {
      score = 0.95;
    } else {
      // Checksum mismatch -> almost certainly not an NID. Keep a residual
      // score so the context window below can still rescue it.
      score = 0.2;
    }
    final windowStart = offset - 40 < 0 ? 0 : offset - 40;
    final windowEnd =
        offset + nid.length + 40 > normalizedText.length
            ? normalizedText.length
            : offset + nid.length + 40;
    final window = normalizedText.substring(windowStart, windowEnd);
    if (_contextWords.any(window.contains)) {
      score = (score + 0.3).clamp(0.0, 1.0);
    }
    if (score < 0.4) return null;
    return score;
  }

  static List<PiiFinding> _removeDuplicates(List<PiiFinding> results) {
    final sorted = [...results]..sort((a, b) {
      final cmp = b.score.compareTo(a.score);
      return cmp != 0 ? cmp : a.start.compareTo(b.start);
    });
    final unique = <PiiFinding>[];
    for (final r in sorted) {
      final overlaps = unique.any(
        (u) => r.start < u.end && u.start < r.end,
      );
      if (!overlaps) unique.add(r);
    }
    return unique;
  }

  /// Detect + redact in one pass. NEVER throws for detection failures —
  /// detection is pure; the fail-closed wrapper lives in the call sites
  /// (a scrubber crash must block the payload, not leak it).
  PiiScrubResult scrub(String text, {PiiRedaction operator = PiiRedaction.redact}) {
    final findings = findNationalIds(text);
    if (findings.isEmpty) {
      return PiiScrubResult(
        scrubbedText: text,
        findings: const [],
        blocked: false,
      );
    }
    final buffer = StringBuffer();
    var cursor = 0;
    for (final f in findings) {
      buffer.write(text.substring(cursor, f.start));
      switch (operator) {
        case PiiRedaction.redact:
          buffer.write(redactionLabel);
        case PiiRedaction.mask:
          final last4 = f.text.length >= 4 ? f.text.substring(f.text.length - 4) : f.text;
          buffer.write('*' * (f.text.length - 4 < 0 ? 0 : f.text.length - 4) + last4);
      }
      cursor = f.end;
    }
    buffer.write(text.substring(cursor));
    return PiiScrubResult(
      scrubbedText: buffer.toString(),
      findings: findings,
      blocked: false,
    );
  }
}
