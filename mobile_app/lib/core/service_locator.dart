import 'package:flutter/material.dart';

import '../data/local/clay_database.dart';
import '../data/local/daos.dart';
import '../data/remote/backend_client.dart';
import '../data/sync/sync_manager.dart';
import '../domain/legal/egyptian_deadline_calculator.dart';
import '../domain/security/pii_scrubber.dart';

/// Composition root. The default base URL targets the local Zero-Trust
/// stack; override at build time:
///   --dart-define=BACKEND_BASE_URL=https://192.168.1.20:8300
class ServiceLocator {
  ServiceLocator._();

  static late BackendClient backend;
  static late ClayDatabase database;
  static late CaseDao caseDao;
  static late HearingDao hearingDao;
  static late SyncManager syncManager;
  static const EgyptianDeadlineCalculator deadlineCalculator =
      EgyptianDeadlineCalculator();
  static const PiiScrubber piiScrubber = PiiScrubber();

  static String get _baseUrl {
    const fromDefine = String.fromEnvironment(
      'BACKEND_BASE_URL',
      defaultValue: 'http://127.0.0.1:8300',
    );
    return fromDefine;
  }

  static Future<void> init() async {
    backend = BackendClient(
      baseUrl: _baseUrl,
      tlsFingerprint: BackendClient.tlsFingerprintDefine,
    );
    database = ClayDatabase();
    caseDao = CaseDao(database);
    hearingDao = HearingDao(database);
    syncManager = SyncManager(db: database, client: backend);
    debugPrint('[ServiceLocator] ready (backend=$_baseUrl)');
  }
}
