import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Hardware-backed secret vault. The SQLCipher key is 32 random bytes (hex),
/// generated once, stored via Android Keystore (`flutter_secure_storage`),
/// and never leaves the device.
class SecretVault {
  SecretVault({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  static const String _dbKeyStorageName = 'legal_clay_db_key';

  final FlutterSecureStorage _storage;

  /// Returns the stored 64-hex-char (32-byte) DB key, creating it on first
  /// run with the platform CSPRNG. Key material lives only in Keystore-backed
  /// storage — never in SharedPreferences, never in the database file itself.
  Future<String> getOrCreateDatabaseKey() async {
    final existing = await _storage.read(key: _dbKeyStorageName);
    if (existing != null && existing.length == 64) return existing;

    final key = _randomHexKey();
    await _storage.write(key: _dbKeyStorageName, value: key);
    return key;
  }

  /// 32 cryptographically-random bytes as 64 hex chars.
  String _randomHexKey() {
    final rng = Random.secure();
    return List<int>.generate(32, (_) => rng.nextInt(256))
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
  }
}
