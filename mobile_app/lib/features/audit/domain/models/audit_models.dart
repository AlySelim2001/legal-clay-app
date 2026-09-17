import 'package:equatable/equatable.dart';

class LegalIssue extends Equatable {
  final String severity;
  final String description;
  final String recommendation;

  const LegalIssue({
    required this.severity,
    required this.description,
    required this.recommendation,
  });

  factory LegalIssue.fromJson(Map<String, dynamic> json) => LegalIssue(
        severity: json['severity']?.toString() ?? 'info',
        description: json['description']?.toString() ?? '',
        recommendation: json['recommendation']?.toString() ?? '',
      );

  @override
  List<Object?> get props => [severity, description, recommendation];
}

class AuditResult extends Equatable {
  final String agent;
  final String status;
  final String summary;
  final int complianceScore;
  final List<LegalIssue> issues;
  final String sanitizedText;
  final bool isOfflineCached;

  const AuditResult({
    required this.agent,
    required this.status,
    required this.summary,
    required this.complianceScore,
    required this.issues,
    this.sanitizedText = '',
    this.isOfflineCached = false,
  });

  factory AuditResult.fromApiResponse(Map<String, dynamic> json) {
    final data = json['data'] is Map
        ? Map<String, dynamic>.from(json['data'] as Map)
        : <String, dynamic>{};
    final securityAudit = data['security_audit'] is Map
        ? Map<String, dynamic>.from(data['security_audit'] as Map)
        : <String, dynamic>{};
    final rawIssues = data['issues'] is List ? data['issues'] as List : const [];
    final rawFindings = securityAudit['details'] is List
        ? securityAudit['details'] as List
        : const [];
    final issues = rawIssues.whereType<Map>().map((item) => LegalIssue.fromJson(
          Map<String, dynamic>.from(item),
        ));
    final findings = rawFindings.whereType<Map>().map((item) {
      final finding = Map<String, dynamic>.from(item);
      return LegalIssue(
        severity: finding['severity']?.toString() ?? 'warning',
        description: finding['description']?.toString() ?? '',
        recommendation: 'مراجعة هذا الجزء مع محامٍ مختص قبل الاعتماد.',
      );
    });
    final mergedIssues = [...issues, ...findings].toList(growable: false);
    final hasFindings = mergedIssues.isNotEmpty;
    final score = (data['compliance_score'] as num?)?.toInt() ??
        (hasFindings ? 0 : 100);

    return AuditResult(
      agent: json['agent']?.toString() ?? 'LegalAuditorAgent',
      status: json['status']?.toString() ?? 'error',
      summary: data['summary']?.toString() ??
          'تم فحص النص وتحديد الملاحظات الأمنية والقانونية.',
      complianceScore: score.clamp(0, 100),
      issues: mergedIssues,
      sanitizedText: data['sanitized_text']?.toString() ?? '',
    );
  }

  AuditResult copyWithOfflineFlag(bool offline) => AuditResult(
        agent: agent,
        status: status,
        summary: summary,
        complianceScore: complianceScore,
        issues: issues,
        sanitizedText: sanitizedText,
        isOfflineCached: offline,
      );

  @override
  List<Object?> get props => [
        agent,
        status,
        summary,
        complianceScore,
        issues,
        sanitizedText,
        isOfflineCached,
      ];
}
