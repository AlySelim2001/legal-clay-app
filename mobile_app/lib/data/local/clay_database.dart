import 'package:path/path.dart' as p;
import 'package:sqflite_sqlcipher/sqflite.dart';

import 'secret_vault.dart';

/// SQLCipher-encrypted local database (AES-256). Single source of truth for
/// the offline-first flow: every write lands here immediately with
/// isSynced = 0, then the sync queue drains opportunistically.
class ClayDatabase {
  ClayDatabase({SecretVault? vault}) : _vault = vault ?? SecretVault();

  static const String _dbName = 'legal_clay.db';
  static const int _dbVersion = 1;

  final SecretVault _vault;

  Database? _db;

  Future<Database> get database async {
    final existing = _db;
    if (existing != null && existing.isOpen) return existing;
    final key = await _vault.getOrCreateDatabaseKey();
    final dir = await getDatabasesPath();
    final db = await openDatabase(
      p.join(dir, _dbName),
      version: _dbVersion,
      password: key,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
    _db = db;
    return db;
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE cases (
        id TEXT PRIMARY KEY,
        case_number TEXT NOT NULL,
        client_name TEXT NOT NULL,
        court TEXT NOT NULL,
        crime_description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE hearings (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        session_date INTEGER NOT NULL,
        court_room TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute(
      'CREATE INDEX idx_hearings_case ON hearings(case_id, session_date)',
    );

    await db.execute('''
      CREATE TABLE offline_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE scan_records (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        ocr_text TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0
      )
    ''');
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Version 1 is the initial schema; future migrations append here.
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }
}
