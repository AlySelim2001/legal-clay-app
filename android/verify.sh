#!/usr/bin/env bash
# =============================================================================
# CRIM-SYS 2026 — post-integration verification ladder.
#
# Encodes the mandatory order from RELEASE_CHECKLIST.md §3.1. Run from a JDK 17
# machine with the Android SDK (API 36) installed — the cloud dev environment
# has neither and cannot run Gradle at all.
#
# Usage:  ./verify.sh              # full ladder
#         ./verify.sh --citations  # ladder + the CitationValidatorTest gate
# =============================================================================
set -euo pipefail

TARGET_TEST=""
if [[ "${1:-}" == "--citations" ]]; then
  TARGET_TEST="net.crimsys.app.domain.legal.CitationValidatorTest"
elif [[ -n "${1:-}" ]]; then
  echo "Unknown option: $1 (supported: --citations)" >&2
  exit 2
fi

echo "── Preconditions ──────────────────────────────────────────────"
if ! command -v java >/dev/null 2>&1; then
  echo "✗ java not found — this ladder requires JDK 17 (cloud env cannot run it)" >&2
  exit 1
fi
JAVA_MAJOR=$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+)\..*/\1/')
if [[ "$JAVA_MAJOR" != "17" ]]; then
  echo "✗ JDK 17 required, found: $(java -version 2>&1 | head -1)" >&2
  exit 1
fi
if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
  echo "✗ ANDROID_HOME/ANDROID_SDK_ROOT unset — API 36 platform + build-tools required" >&2
  exit 1
fi
echo "✓ JDK 17 + Android SDK detected"

cd "$(dirname "$0")"

echo "── 1/7 clean ─────────────────────────────────────────────────"
./gradlew clean

echo "── 2/7 test (all units, debug+release) ───────────────────────"
./gradlew test

echo "── 3/7 lint ──────────────────────────────────────────────────"
./gradlew lint

echo "── 4/7 assembleDebug ─────────────────────────────────────────"
./gradlew assembleDebug

echo "── 5/7 assembleRelease ───────────────────────────────────────"
./gradlew assembleRelease

echo "── 6/7 bundleRelease ─────────────────────────────────────────"
./gradlew bundleRelease

if [[ -n "$TARGET_TEST" ]]; then
  echo "── 7/7 targeted: $TARGET_TEST ─────────────────────────────"
  ./gradlew test --tests "$TARGET_TEST"
else
  echo "── 7/7 skipped (pass --citations to include the citation gate)"
fi

echo "═══════════════════════════════════════════════════════════════"
echo "✓ Verification ladder complete — artifacts cleared for inspection"
echo "  (release distribution copies: ./gradlew copyReleaseApk | copyReleaseBundle)"
