// Legal Clay App — shared constants (single source of truth for policy strings).

import 'package:flutter/foundation.dart';

/// API route paths on the local Zero-Trust backend.
/// MUST mirror the FastAPI contracts in `local-ai/services/legal-backend/`
/// and the nginx proxy in `local-ai/services/frontend/nginx.conf`.
abstract final class ApiPaths {
  static const String health = '/health';
  static const String analyze = '/analyze';
  static const String ocr = '/ocr';
  static const String forensicsSsim = '/forensics/ssim';
  static const String scrub = '/scrub';
}

/// `--dart-define` knobs. Release builds default to HTTPS; debug builds may
/// point at the compose stack on loopback/LAN (see android debug manifest).
abstract final class BuildConfig {
  static const String backendHost = String.fromEnvironment(
    'BACKEND_HOST',
    defaultValue: '127.0.0.1',
  );
  static const String backendPort = String.fromEnvironment(
    'BACKEND_PORT',
    defaultValue: '8300',
  );

  /// SHA-256 (hex, colons optional) of the server certificate to pin in
  /// release. Empty = rely on the system CA store (still HTTPS, still
  /// validated — just not pinned to one cert).
  static const String tlsFingerprint = String.fromEnvironment(
    'TLS_FINGERPRINT_SHA256',
  );

  static bool get isRelease => kReleaseMode;

  /// Base URL for the backend. RELEASE IS HTTPS-ONLY — enforced again in
  /// BackendClient's constructor (defense in depth).
  static String get baseUrl {
    final scheme = kReleaseMode ? 'https' : 'http';
    return '$scheme://$backendHost:$backendPort';
  }
}

/// Legal / policy text shown in the UI. Kept verbatim and centralized so the
/// disclaimer cannot drift between screens.
abstract final class LegalText {
  /// Shown verbatim when the backend pipeline blocks an answer
  /// (Ragas < 0.95, PII gate, or service failure).
  static const String holdMessage =
      'النظام غير قادر على تقديم إجابة موثوقة لهذا السؤال الآن. '
      'لا تعتمد على أي معلومة غير موثقة — راجع المحامي المسؤول أو القنوات الرسمية.';

  static const String reviewPendingAr =
      'بانتظار مراجعة قانونية — لا يُعتد بالمدة إلا بعد اعتماد المحامي';

  static const String offlineNoticeAr =
      'غير متصل بالخادم المحلي — بياناتك محفوظة على الجهاز وستتاح عند الاتصال';

  static const String disclaimerAr =
      'التطبيق أداة تنظيمية مساعدة ولا يقدم استشارة قانونية ولا يُغني عن '
      'مراجعة المحامي المسؤول. جميع حسابات المواعيد تقديرية — تحقق دائماً من '
      'القنوات الرسمية قبل أي إجراء إجرائي.';

  static const String privacyAr =
      'بياناتك تُخزَّن على هذا الجهاز فقط داخل قاعدة بيانات مشفّرة (SQLCipher). '
      'مفتاح التشفير يُولَّد على الجهاز ويُحفظ في Android Keystore ولا يترك '
      'جهازك أبداً. لا يوجد أي تتبع أو تحليلات أو خدمات سحابية.';
}

/// Urgency colors — same tokens as the web app (`urgency-critical/high/normal`).
abstract final class UrgencyColors {
  static const int critical = 0xFFC0392B; // ≤ 3 days
  static const int high = 0xFFF1C40F;     // ≤ 7 days
  static const int normal = 0xFF27AE60;   // > 14 days
}
