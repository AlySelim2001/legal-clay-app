// Legal Clay App — error model (mirrors android Result.kt / AppError).

import 'package:equatable/equatable.dart';

sealed class AppError with EquatableMixin {
  const AppError();

  /// User-facing Arabic message — the UI renders this verbatim, never a raw
  /// exception (which could leak technical detail, or worse, PII in logs).
  String get messageAr;

  @override
  List<Object?> get props => [];
}

final class NetworkError extends AppError {
  const NetworkError([this.detail]);
  final String? detail;

  @override
  String get messageAr =>
      'تعذر الاتصال بالخادم المحلي — بياناتك محفوظة على الجهاز وستتاح عند الاتصال';

  @override
  List<Object?> get props => [detail];
}

final class ServerError extends AppError {
  const ServerError(this.statusCode, [this.detail]);
  final int statusCode;
  final String? detail;

  @override
  String get messageAr => 'خطأ من الخادم المحلي (رمز $statusCode)';

  @override
  List<Object?> get props => [statusCode, detail];
}

final class PiiBlockedError extends AppError {
  const PiiBlockedError(this.reasonAr);
  final String reasonAr;

  @override
  String get messageAr => reasonAr;

  @override
  List<Object?> get props => [reasonAr];
}

final class ValidationError extends AppError {
  const ValidationError(this.reasonAr);
  final String reasonAr;

  @override
  String get messageAr => reasonAr;

  @override
  List<Object?> get props => [reasonAr];
}

final class StorageError extends AppError {
  const StorageError([this.detail]);
  final String? detail;

  @override
  String get messageAr =>
      'تعذر الوصول إلى قاعدة البيانات المشفّرة — لم يتم فقدان أي بيانات، أعد المحاولة';

  @override
  List<Object?> get props => [detail];
}

/// Configuration problems that must never be silently retried
/// (e.g. a non-HTTPS base URL in a release build).
final class ConfigurationError extends AppError {
  const ConfigurationError(this.reasonAr);
  final String reasonAr;

  @override
  String get messageAr => reasonAr;

  @override
  List<Object?> get props => [reasonAr];
}

final class UnknownError extends AppError {
  const UnknownError([this.detail]);
  final String? detail;

  @override
  String get messageAr => 'خطأ غير متوقع';

  @override
  List<Object?> get props => [detail];
}
