import 'dart:convert';

import '../local/clay_database.dart';

/// Encrypted at rest (SQLCipher). Never leaves the device un-queued:
/// [insert] writes the row AND enqueues an offline action for the backend.
class CaseDao {
  CaseDao(this._db);

  final ClayDatabase _db;

  Future<void> insert({
    required String id,
    required String caseNumber,
    required String clientName,
    required String court,
    required String crimeDescription,
    required int createdAt,
  }) async {
    final db = await _db.database;
    final batch = db.batch();
    batch.insert('cases', {
      'id': id,
      'case_number': caseNumber,
      'client_name': clientName,
      'court': court,
      'crime_description': crimeDescription,
      'status': 'active',
      'created_at': createdAt,
      'updated_at': createdAt,
      'is_synced': 0,
    });
    batch.insert('offline_actions', {
      'action_type': 'case.create',
      'payload': jsonEncode({
        'id': id,
        'case_number': caseNumber,
        'client_name': clientName,
        'court': court,
        'crime_description': crimeDescription,
        'created_at': createdAt,
      }),
      'created_at': createdAt,
      'retry_count': 0,
    });
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, Object?>>> observeAll() async {
    final db = await _db.database;
    return db.query('cases', orderBy: 'updated_at DESC');
  }

  Future<void> markSynced(String id) async {
    final db = await _db.database;
    await db.update(
      'cases',
      {'is_synced': 1},
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}

/// Hearing/session rows with an index tuned for the calendar day query.
class HearingDao {
  HearingDao(this._db);

  final ClayDatabase _db;

  Future<void> insert({
    required String id,
    required String caseId,
    required int sessionDate,
    required String courtRoom,
    required String notes,
    required int createdAt,
  }) async {
    final db = await _db.database;
    final batch = db.batch();
    batch.insert('hearings', {
      'id': id,
      'case_id': caseId,
      'session_date': sessionDate,
      'court_room': courtRoom,
      'notes': notes,
      'created_at': createdAt,
      'is_synced': 0,
    });
    batch.insert('offline_actions', {
      'action_type': 'hearing.create',
      'payload': jsonEncode({
        'id': id,
        'case_id': caseId,
        'session_date': sessionDate,
        'court_room': courtRoom,
        'notes': notes,
        'created_at': createdAt,
      }),
      'created_at': createdAt,
      'retry_count': 0,
    });
    await batch.commit(noResult: true);
  }

  /// Hearings on one calendar day (epoch millis within [startOfDay, endOfDay)).
  Future<List<Map<String, Object?>>> forDay(
    int startOfDayMillis,
    int endOfDayMillis,
  ) async {
    final db = await _db.database;
    return db.query(
      'hearings',
      where: 'session_date >= ? AND session_date < ?',
      whereArgs: [startOfDayMillis, endOfDayMillis],
      orderBy: 'session_date ASC',
    );
  }

  Future<List<Map<String, Object?>>> all() async {
    final db = await _db.database;
    return db.query('hearings', orderBy: 'session_date ASC');
  }
}
