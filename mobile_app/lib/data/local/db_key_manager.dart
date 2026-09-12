// DB encryption key lifecycle.
//
// The SQLCipher passphrase is 32 random bytes (hex). It is generated ONCE on
// first launch and stored in flutter_secure_storage, which on Android is
// backed by the hardware Keystore (StrongBox when available). The key never
// leaves the device and is never persisted anywhere else — lose the Keystore
// and the database is cryptographically gone, which is the correct failure
// mode for legal evidence.
//
// FAIL-CLOSED: if secure storage itself is unreadable we throw — the app must
// never fall back to opening the database with an empty or derived-static
// password. No key → no DB → no silent plaintext.

import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class DbKeyManager {
  DbKeyManager({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  static const String _keyName = 'legal_clay.db.key.v1';

  final FlutterSecureStorage _storage;
  String? _cached;

  /// Returns the passphrase, creating it on first use.
  /// Throws on any secure-storage failure — callers must not open the DB.
  Future<String> getOrCreateKey() async {
    final cached = _cached;
    if (cached != null) return cached;

    try {
      final existing = await _storage.read(key: _keyName);
      if (existing != null && existing.isNotEmpty) {
        _cached = existing;
        return existing;
      }
      final generated = _generateKey();
      await _storage.write(key: _keyName, value: generated);
      _cached = generated;
      return generated;
    } on Exception {
      // Do not swallow: a broken Keystore must stop the DB from opening.
      rethrow;
    }
  }

  static String _generateKey() {
    final rng = Random.secure();
    final bytes = List<int>.generate(32, (_) => rng.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
}
