import 'package:equatable/equatable.dart';

class IndexingResult extends Equatable {
  final String status;
  final String message;
  final String documentId;
  final int indexedCharacterCount;
  final bool isOfflineQueued;

  const IndexingResult({
    required this.status,
    required this.message,
    required this.documentId,
    required this.indexedCharacterCount,
    this.isOfflineQueued = false,
  });

  factory IndexingResult.fromApiResponse(Map<String, dynamic> json) {
    final data = json['data'] is Map
        ? Map<String, dynamic>.from(json['data'] as Map)
        : json;
    return IndexingResult(
      status: json['status']?.toString() ?? 'error',
      message: json['message']?.toString() ?? 'تمت معالجة المستند.',
      documentId: data['document_id']?.toString() ?? '',
      indexedCharacterCount:
          (data['indexed_char_count'] as num?)?.toInt() ??
              (data['chunk_count'] as num?)?.toInt() ??
              0,
    );
  }

  IndexingResult copyWithOfflineQueued(bool queued) => IndexingResult(
        status: status,
        message: message,
        documentId: documentId,
        indexedCharacterCount: indexedCharacterCount,
        isOfflineQueued: queued,
      );

  @override
  List<Object?> get props => [
        status,
        message,
        documentId,
        indexedCharacterCount,
        isOfflineQueued,
      ];
}
