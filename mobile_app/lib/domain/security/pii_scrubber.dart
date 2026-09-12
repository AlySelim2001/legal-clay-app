/// On-device PII scrubber — byte-parity Dart port of the server recognizer
/// `local-ai/services/presidio-scrubber/egyptian_nid.py`.
///
/// The Egyptian National ID (الرقم القومي) is exactly 14 digits and is
/// information-dense:
///   digit  1     -> century (2 = born 1900s, 3 = born 2000s)
///   digits 2-7   -> YYMMDD date of birth
///   digits 8-9   -> governorate code (01 Cairo .. 33 Matrouh; 88 = born abroad)
///   digits 10-13 -> birth serial (13th digit: odd = male, even = female)
///   digit  14    -> checksum (standard Luhn check digit over the first 13)
///
/// Input text may contain Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) — common in OCR
/// output — so [PiiScrubber.scrub] normalizes them before matching.
///
/// FAIL-CLOSED POLICY: if scrubbing itself throws, [ScrubResult.blocked] is
/// returned and the caller MUST NOT send the payload anywhere. A blocked
/// payload is never leaked — the gate never opens "temporarily".
library;

/// One detected NID occurrence, indexed into the ORIGINAL (non-normalized)
/// text — normalization is 1:1 per character, so offsets stay valid.
class PiiMatch {
  const PiiMatch({
    required this.start,
    required this.end,
    required this.score,
  });

  final int start;
  final int end;
  final double score;
}

class ScrubResult {
  const ScrubResult({
    required this.sanitizedText,
    required this.redactedCount,
    required this.blocked,
    this.blockReason,
  });

  /// Payload that is safe to transmit (redacted). Empty when blocked.
  final String sanitizedText;

  /// Number of NIDs masked.
  final int redactedCount;

  /// True when scrubbing FAILED — payload must never leave the device.
  final bool blocked;

  final String? blockReason;

  bool get isSafeToSend => !blocked;
}

class PiiScrubber {
  const PiiScrubber();

  /// Token the server anonymizer uses for NIDs — identical so server logs and
  /// on-device previews render the same placeholder.
  static const String redactionLabel = '<رقم_قومي_محجوب>';

  static const String entityName = 'EG_NATIONAL_ID';

  /// Egyptian governorate codes (NID digits 8-9): 01-33 allocated (05-10, 20,
  /// 30 reserved), 88 = born abroad. We accept 01-35 + 88: for a scrubber,
  /// over-inclusion is harmless (the Luhn checksum still filters randoms)
  /// while excluding real codes like 01 (Cairo) would leak PII.
  /// PUBLIC for test parity with `egyptian_nid.py` — do not branch on it.
  static const Set<String> govCodes = {
    '01', '02', '03', '04', '11', '12', '13', '14', '15', '16', //
    '17', '18', '19', '21', '22', '23', '24', '25', '26', '27', //
    '28', '29', '31', '32', '33', '34', '35', '88',
  };

  static const List<int> _luhnWeights = [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];

  static const List<String> _contextWords = [
    'رقم قومي',
    'الرقم القومي',
    'بطاقة رقمية',
    'بطاقة الرقم القومي',
    'national id',
    'national number',
  ];

  /// Arabic-Indic (U+0660-0669) and Extended Arabic-Indic (U+06F0-06F9)
  /// digits -> ASCII. 1:1 per-character mapping so match offsets remain
  /// valid against the ORIGINAL text.
  static String normalizeDigits(String text) {
    final buffer = StringBuffer();
    for (final code in text.codeUnits) {
      if (code >= 0x0660 && code <= 0x0669) {
        buffer.writeCharCode(0x30 + (code - 0x0660));
      } else if (code >= 0x06F0 && code <= 0x06F9) {
        buffer.writeCharCode(0x30 + (code - 0x06F0));
      } else {
        buffer.writeCharCode(code);
      }
    }
    return buffer.toString();
  }

  /// Luhn check over the first 13 digits validated against the 14th.
  static bool luhnChecksumOk(String nid) {
    var total = 0;
    for (var i = 0; i < 13; i++) {
      final product = int.parse(nid[i]) * _luhnWeights[i];
      total += product ~/ 10 + product % 10;
    }
    return (10 - (total % 10)) % 10 == int.parse(nid[13]);
  }

  /// Structural plausibility of the embedded birth date (months 01-12, days
  /// 01-31 — the century digit already proved by the pattern).
  static bool _birthDateOk(String nid) {
    final mm = nid.substring(3, 5);
    final dd = int.tryParse(nid.substring(5, 7)) ?? -1;
    final month = int.tryParse(mm) ?? -1;
    return month >= 1 && month <= 12 && dd >= 1 && dd <= 31;
  }

  static bool _centuryOk(String nid) {
    final c = nid.codeUnitAt(0);
    return c == 0x32 || c == 0x33; // '2' or '3'
  }

  static bool _govOk(String nid) => govCodes.contains(nid.substring(7, 9));

  /// Find all NID occurrences. Mirrors the server regex
  /// `(?<!\d)([23]\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|[1-8][0-9]|88)\d{5})(?!\d)`
  /// — i.e. only runs of EXACTLY 14 digits qualify (15-digit runs cannot
  /// partially match).
  List<PiiMatch> analyze(String text) {
    final normalized = normalizeDigits(text);
    final matches = <PiiMatch>[];
    var index = 0;
    while (index < normalized.length) {
      final code = normalized.codeUnitAt(index);
      if (code < 0x30 || code > 0x39) {
        index++;
        continue;
      }
      // Start of a digit run.
      var end = index;
      while (end < normalized.length) {
        final c = normalized.codeUnitAt(end);
        if (c < 0x30 || c > 0x39) break;
        end++;
      }
      final runLength = end - index;
      if (runLength == 14) {
        final nid = normalized.substring(index, end);
        final score = _score(nid, index, text);
        if (score != null) {
          matches.add(PiiMatch(start: index, end: end, score: score));
        }
      }
      index = end;
    }
    return _removeDuplicates(matches);
  }

  double? _score(String nid, int offset, String text) {
    if (!_centuryOk(nid)) return null;
    if (!_birthDateOk(nid)) return null;
    if (!_govOk(nid)) return null;

    double score;
    if (!luhnChecksumOk(nid)) {
      // Checksum mismatch -> almost certainly not an NID. Keep a tiny
      // residual score so context words can still rescue it.
      score = 0.2;
    } else {
      score = 0.95;
    }
    // Context words within 40 chars raise confidence.
    final from = (offset - 40).clamp(0, text.length);
    final to = (offset + nid.length + 40).clamp(0, text.length);
    final window = text.substring(from, to);
    for (final word in _contextWords) {
      if (window.contains(word)) {
        score = (score + 0.3).clamp(0.0, 1.0);
        break;
      }
    }
    if (score < 0.4) return null;
    return score;
  }

  static List<PiiMatch> _removeDuplicates(List<PiiMatch> matches) {
    // Overlapping matches: keep the highest score.
    final sorted = List<PiiMatch>.from(matches)
      ..sort((a, b) {
        final byScore = b.score.compareTo(a.score);
        return byScore != 0 ? byScore : a.start.compareTo(b.start);
      });
    final unique = <PiiMatch>[];
    for (final candidate in sorted) {
      final overlaps = unique.any(
        (m) => candidate.start < m.end && m.start < candidate.end,
      );
      if (!overlaps) unique.add(candidate);
    }
    return unique;
  }

  /// Scrub NIDs from [text]. FAIL-CLOSED: any internal error returns a
  /// blocked result — never a half-scrubbed payload.
  ScrubResult scrub(String text) {
    try {
      final matches = analyze(text);
      if (matches.isEmpty) {
        return ScrubResult(
          sanitizedText: text,
          redactedCount: 0,
          blocked: false,
        );
      }
      final buffer = StringBuffer();
      var cursor = 0;
      for (final match in matches) {
        buffer.write(text.substring(cursor, match.start));
        buffer.write(redactionLabel);
        cursor = match.end;
      }
      buffer.write(text.substring(cursor));
      return ScrubResult(
        sanitizedText: buffer.toString(),
        redactedCount: matches.length,
        blocked: false,
      );
    } catch (error) {
      // Fail closed: never return a possibly-unscrubbed payload.
      return ScrubResult(
        sanitizedText: '',
        redactedCount: 0,
        blocked: true,
        blockReason: 'pii_scrub_failed: $error',
      );
    }
  }

  /// Throws when the payload cannot be proven clean — use where a caller
  /// would otherwise forget to check [ScrubResult.blocked].
  String scrubOrThrow(String text) {
    final result = scrub(text);
    if (result.blocked) {
      throw StateError(result.blockReason ?? 'pii_scrub_failed');
    }
    return result.sanitizedText;
  }
}
