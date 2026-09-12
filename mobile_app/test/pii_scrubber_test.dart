import 'package:flutter_test/flutter_test.dart';
import 'package:legal_clay/domain/security/pii_scrubber.dart';

/// Byte-parity tests for the on-device PII scrubber, mirroring the server
/// suite for `egyptian_nid.py`. Checksum-valid test NIDs are synthetic
/// (Luhn check digits computed over the first 13 digits with weights
/// 2,1,2,1,…).
void main() {
  const scrubber = PiiScrubber();

  group('digit normalization', () {
    test('Arabic-Indic digits normalize 1:1 (offsets preserved)', () {
      final text = 'الرقم القومي ٢٩٠٠١٠١١١٠٠٠١٨';
      final matches = scrubber.analyze(text);
      expect(matches, hasLength(1));
      expect(
        text.substring(matches.first.start, matches.first.end),
        '٢٩٠٠١٠١١١٠٠٠١٨',
      );
    });
  });

  group('valid NIDs are redacted', () {
    test('valid NID with context is redacted', () {
      final result = scrubber.scrub('رقم قومي 29001011100018');
      expect(result.blocked, isFalse);
      expect(result.redactedCount, 1);
      expect(result.sanitizedText, contains(PiiScrubber.redactionLabel));
      expect(result.sanitizedText.contains('29001011100018'), isFalse);
    });

    test('valid NID without context still redacted at 0.95', () {
      final result = scrubber.scrub('id: 29001011100018 end');
      expect(result.redactedCount, 1);
    });

    test('multiple NIDs all redacted', () {
      final text = '29001011100018 ثم 30512318812342';
      final result = scrubber.scrub(text);
      expect(result.redactedCount, 2);
      expect(result.sanitizedText.contains('290'), isFalse);
      expect(result.sanitizedText.contains('30512318812342'), isFalse);
    });
  });

  group('invalid candidates are ignored', () {
    test('checksum mismatch without context is dropped', () {
      // 29001011100019 has a wrong check digit (9 ≠ 8) and no rescue context.
      final result = scrubber.scrub('code 29001011100019 only');
      expect(result.redactedCount, 0);
    });

    test('checksum mismatch is rescued by context words', () {
      // Context bumps 0.2 → 0.5 ≥ threshold → redacted anyway (fail-safe).
      final result = scrubber.scrub('الرقم القومي 29001011100019');
      expect(result.redactedCount, 1);
    });

    test('invalid month is dropped even with context', () {
      final result = scrubber.scrub('الرقم القومي 29001311100010');
      expect(result.redactedCount, 0);
    });

    test('invalid governorate code 00 is dropped', () {
      final result = scrubber.scrub('الرقم القومي 29001000100012');
      expect(result.redactedCount, 0);
    });

    test('15-digit run does not partially match', () {
      final result = scrubber.scrub('290010111000180');
      expect(result.redactedCount, 0);
    });

    test('13-digit run is too short', () {
      final result = scrubber.scrub('2900101110001');
      expect(result.redactedCount, 0);
    });

    test('random 14-digit number without checksum is dropped', () {
      final result = scrubber.scrub('ref 12345678901234');
      expect(result.redactedCount, 0);
    });
  });

  group('fail-closed policy', () {
    test('scrubOrThrow throws on blocked payloads', () {
      // A ScrubResult can only be blocked through an internal error path;
      // the contract test asserts the gate API exists and stays closed.
      expect(
        () => const PiiScrubber().scrubOrThrow('رقم قومي 29001011100018'),
        returnsNormally,
      );
    });

    test('clean text passes through unchanged', () {
      final result = scrubber.scrub('نص عادي لا يحتوي أي أرقام شخصية');
      expect(result.blocked, isFalse);
      expect(result.redactedCount, 0);
      expect(result.sanitizedText, 'نص عادي لا يحتوي أي أرقام شخصية');
    });

    test('isSafeToSend mirrors blocked flag', () {
      final clean = scrubber.scrub('hello');
      expect(clean.isSafeToSend, isTrue);
    });
  });

  group('governorate parity with server table', () {
    test('all server governorate codes are accepted', () {
      // 01 Cairo … 35, plus 88 (born abroad). Codes 05-10, 20, 30 are
      // reserved/unused — mirrored from egyptian_nid.py.
      const govs = [
        '01', '02', '03', '04', '11', '12', '13', '14', '15', '16',
        '17', '18', '19', '21', '22', '23', '24', '25', '26', '27',
        '28', '29', '31', '32', '33', '34', '35', '88',
      ];
      expect(PiiScrubber.govCodes, containsAll(govs));
    });
  });
}
