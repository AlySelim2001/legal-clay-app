import 'package:equatable/equatable.dart';

class RagSource extends Equatable {
  final String id;
  final double score;
  final String text;
  final String? articleNumber;
  final String? category;

  const RagSource({
    required this.id,
    required this.score,
    required this.text,
    this.articleNumber,
    this.category,
  });

  factory RagSource.fromJson(Map<String, dynamic> json) {
    final payload = json['payload'] is Map
        ? Map<String, dynamic>.from(json['payload'] as Map)
        : <String, dynamic>{};
    return RagSource(
      id: json['id']?.toString() ?? '',
      score: (json['score'] as num?)?.toDouble() ?? 0,
      text: payload['text']?.toString() ?? '',
      articleNumber: payload['article_number']?.toString(),
      category: payload['category']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'score': score,
        'payload': {
          'text': text,
          'article_number': articleNumber,
          'category': category,
        },
      };

  @override
  List<Object?> get props => [id, score, text, articleNumber, category];
}

class RagResult extends Equatable {
  final String agent;
  final String status;
  final String message;
  final String query;
  final String answer;
  final List<RagSource> sources;
  final bool isOfflineCached;

  const RagResult({
    required this.agent,
    required this.status,
    required this.message,
    required this.query,
    required this.answer,
    required this.sources,
    this.isOfflineCached = false,
  });

  factory RagResult.fromApiResponse(
    Map<String, dynamic> response,
    String originalQuery,
  ) {
    final data = response['data'] is Map
        ? Map<String, dynamic>.from(response['data'] as Map)
        : <String, dynamic>{};
    final rawSources = data['sources'] is List ? data['sources'] as List : const [];
    return RagResult(
      agent: response['agent']?.toString() ?? 'LegalRAGAgent',
      status: response['status']?.toString() ?? 'error',
      message: response['message']?.toString() ?? '',
      query: data['query']?.toString() ?? originalQuery,
      answer: data['answer']?.toString() ?? 'لم يتم العثور على إجابة قانونية مطابقة.',
      sources: rawSources
          .whereType<Map>()
          .map((source) => RagSource.fromJson(Map<String, dynamic>.from(source)))
          .toList(growable: false),
    );
  }

  RagResult copyWithOfflineFlag(bool offline) => RagResult(
        agent: agent,
        status: status,
        message: message,
        query: query,
        answer: answer,
        sources: sources,
        isOfflineCached: offline,
      );

  @override
  List<Object?> get props => [agent, status, message, query, answer, sources, isOfflineCached];
}
