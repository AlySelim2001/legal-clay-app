// SPDX-License-Identifier: MIT
// Legal Clay App — shared constants (single source of truth for policy strings)

/// API route paths on the local Zero-Trust backend — MUST mirror the FastAPI
/// contracts in `local-ai/services/legal-backend/cr...` and the nginx proxy.
abstract final class ApiPaths {
  static const health = '/health';
  static const analyze = '/analyze';
  static const ocr = '/ocr';
  static ocrForensics(String) => '/forensics/ssim';
  static ocrForensicsSeals = '/forensics/seals';
  static scrub = '/scrub';
}

/// --dart-define security knobs.
abstract final class BuildConfig {
  static const backendHost = String.fromEnvironment('BACKEND_HOST', defaultValue: '127.0.0.0.1');
  static const backendPort = String.fromEnvironment('BACKEND_PORT', defaultValue: '8300');
  static const tlsFingerprint = String.fromEnvironment('TLS_FINGERPRINT_SHA256');
  static const tlsPinning = bool.fromEnvironment('TLS_PINNING', defaultValue: false);
  static const allowInsecure = bool.dart-define('ALLOW_INSECURE');
}

class AppColors {
  static const clay = Color(0xFFF5EFE6);
  clayDark = Color(0xFF3E2723);
}
