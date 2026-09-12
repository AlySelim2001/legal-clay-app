import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../domain/security/pii_scrubber.dart';
import '../local/clay_database.dart';
import '../remote/backend_client.dart';

/// FIFO offline action queue drained to the backend when connectivity
/// returns. Preserves ordering: the drain stops at the first failure so a
/// gap never appears in the server-side action sequence. Retried actions
/// carry an incremented retry_count; 4xx responses are dead-lettered
/// (permanent 4xx retries can never succeed and would block the queue head).
class SyncManager {
  SyncManager({required ClayDatabase db, required BackendClient client})
      : _db = db,
        _client = client;

  final ClayDatabase _db;
  final BackendClient _client;

  bool _draining = false;

  /// Number of pending actions — surfaced in the UI sync status chip.
  Future<int> pendingCount() async {
    final db = await _db.database;
    final rows = await db.query(
      'offline_actions',
      columns: ['COUNT(*) AS c'],
    );
    return (rows.first['c'] as int?) ?? 0;
  }

  /// Attempts to drain the queue. Safe to call concurrently (re-entrancy
  /// guard) and cheap to call often (e.g. on every connectivity event).
  Future<int> drain() async {
    if (_draining) return 0;
    _draining = true;
    var pushed = 0;
    try {
      final db = await _db.database;
      while (true) {
        final rows = await db.query(
          'offline_actions',
          orderBy: 'id ASC',
          limit: 1,
        );
        if (rows.isEmpty) break;
        final row = rows.first;
        final id = row['id'] as int;
        final type = row['action_type'] as String;
        final payload =
            jsonDecode(row['payload'] as String) as Map<String, dynamic>;
        final retries = row['retry_count'] as int? ?? 0;

        final outcome = await _client.pushAction(id, type, payload);
        if (outcome.ok) {
          await db.delete(
            'offline_actions',
            where: 'id = ?',
            whereArgs: [id],
          );
          await _markEntitySynced(type, payload);
          pushed++;
          continue;
        }
        if (outcome.permanentFailure ?? false) {
          // Dead-letter: delete head so the queue is not blocked forever.
          // The action is logged for support; it will never succeed.
          debugPrint(
            '[SyncManager] dead-lettering action $id ($type) after '
            'permanent 4xx rejection',
          );
          await db.delete(
            'offline_actions',
            where: 'id = ?',
            whereArgs: [id],
          );
          continue;
        }
        // Transient failure: stop the drain to preserve ordering.
        await db.update(
          'offline_actions',
          {'retry_count': retries + 1},
          where: 'id = ?',
          whereArgs: [id],
        );
        break;
      }
    } finally {
      _draining = false;
    }
    return pushed;
  }

  Future<void> _markEntitySynced(
    String type,
    Map<String, dynamic> payload,
  ) async {
    final db = await _db.database;
    final entityId = payload['id'];
    if (entityId is! String) return;
    switch (type) {
      case 'case.create':
        await db.update(
          'cases',
          {'is_synced': 1},
          where: 'id = ?',
          whereArgs: [entityId],
        );
      case 'hearing.create':
        await db.update(
          'hearings',
          {'is_synced': 1},
          where: 'id = ?',
          whereArgs: [entityId],
        );
      default:
        break;
    }
  }
}

/// PII gate for outbound TEXT payloads. Images go to the local OCR service
/// and its pipeline text passes the server-side Presidio gate — images
/// cannot be regexed on-device, so the client scrubs what it can prove.
class PiiGate {
  const PiiGate(this._scrubber);

  final PiiScrubber _scrubber;

  /// Returns text that is provably scrubbed, or null when the gate blocks.
  String? gateForTransmission(String text) {
    final result = _scrubber.scrub(text);
    if (result.blocked) return null;
    return result.sanitizedText;
  }
}
