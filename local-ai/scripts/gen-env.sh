#!/usr/bin/env bash
# ============================================================================
# CRIM-SYS 2026 — .env generator (replaces .env.example)
#
# Why a generator instead of a template with placeholder strings?
#   Placeholders like "changeme" end up in production unchanged. This script
#   generates REAL secrets with `openssl rand -hex 32` (>= 32 chars, as the
#   fail-closed guards in every service require) and locks file permissions
#   to 600. It refuses to overwrite an existing .env unless --force is given.
#
# Usage:
#   bash scripts/gen-env.sh            # create local-ai/.env (idempotent-safe)
#   bash scripts/gen-env.sh --force    # regenerate, overwriting existing .env
#   make env                           # same as the first line
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."   # local-ai root

ENV_FILE=".env"

if [[ -f "$ENV_FILE" && "${1:-}" != "--force" ]]; then
  echo "REFUSING to overwrite existing $ENV_FILE (use --force to regenerate)." >&2
  exit 1
fi

gen() { openssl rand -hex 32; }

cat > "$ENV_FILE" <<EOF
# ============================================================================
# CRIM-SYS 2026 — Local AI stack secrets (GENERATED — do not commit)
# Regenerate: bash scripts/gen-env.sh --force
# ============================================================================

# Shared service-to-service authentication key (>= 32 chars — fail-closed).
INTERNAL_API_KEY=$(gen)

# Qdrant vector-store API key (deliberately SEPARATE from INTERNAL_API_KEY).
QDRANT_API_KEY=$(gen)

# n8n credential encryption + editor basic auth.
N8N_ENCRYPTION_KEY=$(gen)
N8N_USER=admin
N8N_PASSWORD=$(openssl rand -base64 18)

# Telegram delivery (edge network — the ONLY egress of the whole stack).
# Fill these two manually; they cannot be generated locally.
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
TELEGRAM_ADMIN_CHAT_ID=

# Scoping keyword for the daily court-monitor n8n workflow.
SCRAPE_KEYWORD=محكمة النقض

# Models (defaults match docker-compose.yml).
PRIMARY_MODEL=qwen2.5:7b
ALTERNATE_MODEL=jais-family-13b
EOF

chmod 600 "$ENV_FILE"

echo "✔ Wrote $ENV_FILE (chmod 600)."
echo "  → Fill TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID manually, then: make up"
