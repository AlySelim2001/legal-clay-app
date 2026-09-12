#!/usr/bin/env bash
# Generates the release keystore + key.properties for the Flutter mobile app.
# Both outputs are gitignored — they never enter version control.
#
# Usage:  ./security/create-keystore.sh
set -euo pipefail

KEYSTORE_PATH="mobile_app/android/app/upload-keystore.jks"
PROPS_PATH="mobile_app/android/key.properties"
ALIAS="legalclay"

if [ -f "$KEYSTORE_PATH" ]; then
  echo "Keystore already exists at $KEYSTORE_PATH — refusing to overwrite." >&2
  exit 1
fi

read -rsp "Keystore password: " STORE_PASS; echo
read -rsp "Key password (Enter to reuse keystore password): " KEY_PASS; echo
KEY_PASS="${KEY_PASS:-$STORE_PASS}"

keytool -genkeypair -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$STORE_PASS" -keypass "$KEY_PASS" \
  -dname "CN=Legal Clay, OU=Legal, O=CRIM-SYS, L=Cairo, C=EG"

cat > "$PROPS_PATH" <<EOF
storeFile=../../android/app/upload-keystore.jks
storePassword=$STORE_PASS
keyAlias=$ALIAS
keyPassword=$KEY_PASS
EOF
chmod 600 "$PROPS_PATH"

echo ""
echo "✅ Keystore created: $KEYSTORE_PATH"
echo "✅ Properties written: $PROPS_PATH (chmod 600, gitignored)"
echo ""
echo "For CI, add these repo secrets:"
echo "  ANDROID_KEYSTORE_BASE64 = \$(base64 -w0 $KEYSTORE_PATH)"
echo "  KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD"
