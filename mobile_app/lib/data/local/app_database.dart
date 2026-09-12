// Legal Clay App — encrypted local database (SQLCipher).
//
// Single source of truth. All reads for the UI come from here; the network is
// an enrichment, never the primary store. Tables mirror the Kotlin Room
// schema (`cases`, `hearings`) so a future sync bridge maps 1:1.
//
// Filtering happens IN SQL (the P1 discipline — never filter a whole docket
// in memory), and every mutation is wrapped by the repository into the
// offline queue concept the Kotlin app established (queued writes survive
// no-network; the queue itself lives server-side-of-record only when online).

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite_sqlcipher/open.dart' as sqlcipher;

import '../../core/app_error.dart';
import 'db_key_manager.dart';

/// Row shape for a criminal case.
class CaseRecord {
  const CaseRecord({
    required this.id,
    required this.caseNumber,
    required this.courtName,
    required this.caseType,
    required this.memo,
    required this.isSynced,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String caseNumber;
  final String courtName;
  final String caseType;
  final String memo;
  final bool isSynced;
  final int createdAt;
  final int updatedAt;

  Map<String, Object?> toRow() => {
        'id': id,
        'caseNumber': caseNumber,
        'courtName': courtName,
        'caseType': caseType,
        'memo': memo,
        'isSynced': isSynced ? 1 : 0,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };

  static CaseRecord fromRow(Map<String, Object?> row) => CaseRecord(
        id: row['id']! as String,
        caseNumber: row['caseNumber']! as String,
        courtName: row['courtName']! as String,
        caseType: row['caseType']! as String,
        memo: (row['memo'] ?? '')! as String,
        isSynced: ((row['isSynced'] ?? 0)! as int) == 1,
        createdAt: row['createdAt']! as int,
        updatedAt: row['updatedAt']! as int,
      );
}

/// Row shape for a court hearing (جلسة). Dates are stored as epoch-day so
/// calendar math and date-scoped SQL filters stay exact.
class HearingRecord {
  const HearingRecord({
    required this.id,
    required this.caseId,
    required this.caseNumber,
    required this.courtName,
    required this.epochDay,
    required this.timeLabel,
    required this.notes,
  });

  final String id;
  final String caseId;
  final String caseNumber;
  final String courtName;
  final int epochDay;
  final String timeLabel;
  final String notes;

  Map<String, Object?> toRow() => {
        'id': id,
        'caseId': caseId,
        'caseNumber': caseNumber,
        'courtName': courtName,
        'epochDay': epochDay,
        'timeLabel': timeLabel,
        'notes': notes,
      };

  static HearingRecord fromRow(Map<String, Object?> row) => HearingRecord(
        id: row['id']! as String,
        caseId: row['caseId']! as String,
        caseNumber: (row['caseNumber'] ?? '')! as String,
        courtName: row['courtName']! as String,
        epochDay: row['epochDay']! as int,
        timeLabel: (row['timeLabel'] ?? '')! as String,
        notes: (row['notes'] ?? '')! as String,
      );
}

/// Schema version history (never destructive — see migration policy below).
const int dbVersionV1 = 1;

class AppDatabase {
  AppDatabase({required DbKeyManager keyManager}) : _keyManager = keyManager;

  final DbKeyManager _keyManager;
  sqflite.Database? _db;

  Future<sqflite.Database> get database async {
    final existing = _db;
    if (existing != null && existing.isOpen) return existing;
    try {
      final key = await _keyManager
          .getOrCreateKey(); // throws → no DB, fail-closed
      final dir = await getApplicationDocumentsDirectory();
      final db = await sqlcipher.openDatabase(
        p.join(dir.path, 'legal_clay.db'),
        version: dbVersionV1,
        onCreate: _onCreate,
        onUpgrade: _onUpgrade,
        password: key,
      );
      _db = db;
      return db;
    } on AppError {
      rethrow;
    } on Exception catch (e) {
      throw StorageError(e.toString());
    }
  }

  Future<void> _onCreate(sqflite.Database db, int version) async {
    await db.execute('''
      CREATE TABLE cases (
        id TEXT PRIMARY KEY,
        caseNumber TEXT NOT NULL,
        courtName TEXT NOT NULL,
        caseType TEXT NOT NULL,
        memo TEXT NOT NULL DEFAULT '',
        isSynced INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    ''');
    await db.execute(
      'CREATE INDEX index_cases_updatedAt ON cases (updatedAt DESC)',
    );
    await db.execute('''
      CREATE TABLE hearings (
        id TEXT PRIMARY KEY,
        caseId TEXT NOT NULL,
        caseNumber TEXT NOT NULL DEFAULT '',
        courtName TEXT NOT NULL,
        epochDay INTEGER NOT NULL,
        timeLabel TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT ''
      )
    ''');
    // The hot query (upcoming hearings for one case) gets an index scan.
    await db.execute(
      'CREATE INDEX index_hearings_case_day ON hearings (caseId, epochDay)',
    );
  }

  /// Add-only migration ladder: every schema change appends a step here.
  /// Destructive shortcuts (DROP/recreate) are forbidden — this database
  /// holds the only local copy of legal evidence.
  Future<void> _onUpgrade(
    sqflite.Database db,
    int oldVersion,
    int newVersion,
  ) async {
    // if (oldVersion < 2) { ...pure ADD COLUMN steps... }
    throw UnsupportedError(
      'Unimplemented migration $oldVersion → $newVersion: refusing to open '
      'with schema drift (destructive fallback is forbidden).',
    );
  }

  // ------------------------------------------------------------------ cases

  /// Reactive-equivalent read for the case list. SQL sorts; callers never do.
  Future<List<CaseRecord>> getCases() async {
    final db = await database;
    final rows = await db.query(
      'cases',
      orderBy: 'updatedAt DESC',
    );
    return rows.map(CaseRecord.fromRow).toList();
  }

  Future<CaseRecord?> getCaseById(String id) async {
    final db = await database;
    final rows = await db.query(
      'cases',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    return rows.isEmpty ? null : CaseRecord.fromRow(rows.first);
  }

  /// Insert or replace a case row (caller sets timestamps).
  Future<void> upsertCase(CaseRecord record) async {
    final db = await database;
    await db.insert(
      'cases',
      record.toRow(),
      conflictAlgorithm: sqflite.ConflictAlgorithm.replace,
    );
  }

  Future<void> updateMemo(String id, String memoHtml) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;
    await db.update(
      'cases',
      {'memo': memoHtml, 'isSynced': 0, 'updatedAt': now},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> setCaseSynced(String id, bool synced) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;
    await db.update(
      'cases',
      {'isSynced': synced ? 1 : 0, 'updatedAt': now},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // --------------------------------------------------------------- hearings

  /// Upcoming sessions for ONE case — filtered and sorted by SQLite
  /// (WHERE + ORDER BY on the (caseId, epochDay) index), never in memory.
  Future<List<HearingRecord>> getHearingsForCase(
    String caseId,
    int fromEpochDay,
  ) async {
    final db = await database;
    final rows = await db.query(
      'hearings',
      where: 'caseId = ? AND epochDay >= ?',
      whereArgs: [caseId, fromEpochDay],
      orderBy: 'epochDay ASC, timeLabel ASC',
    );
    return rows.map(HearingRecord.fromRow).toList();
  }

  /// All hearings on one day (calendar day tap).
  Future<List<HearingRecord>> getHearingsForDay(int epochDay) async {
    final db = await database;
    final rows = await db.query(
      'hearings',
      where: 'epochDay = ?',
      whereArgs: [epochDay],
      orderBy: 'timeLabel ASC',
    );
    return rows.map(HearingRecord.fromRow).toList();
  }

  Future<void> upsertHearing(HearingRecord record) async {
    final db = await database;
    await db.insert(
      'hearings',
      record.toRow(),
      conflictAlgorithm: sqflite.ConflictAlgorithm.replace,
    );
  }

  Future<void> close() async {
    final existing = _db;
    _db = null;
    if (existing != null && existing.isOpen) {
      await existing.close();
    }
  }
}
