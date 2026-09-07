#!/usr/bin/env bash
#
# Travelog MVP1 — esportazione completa del database.
#
# Crea un dump completo (formato custom pg_dump) di tutto il database
# Travelog: schema, dati, vincoli, indici PostGIS ed estensioni.
# Il file prodotto può essere ripristinato con scripts/db-import.sh.
#
# Uso:
#   bash scripts/db-export.sh [file-destinazione]
#
# Il file di destinazione è opzionale; il default è:
#   database/backups/travelog-<nome-db>-<timestamp>.dump
#
# La connection string è letta da DATABASE_URL (ambiente) oppure dal
# file .env alla radice del repository.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_header() {
  echo ""
  echo "========================================"
  echo "$1"
  echo "========================================"
  echo ""
}

# ── Risoluzione della connection string ─────────────────────────
if [[ -z "${DATABASE_URL:-}" && -f "$REPO_ROOT/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$REPO_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  export DATABASE_URL
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Errore: DATABASE_URL non impostata né presente in $REPO_ROOT/.env" >&2
  exit 1
fi

# ── Individuazione dei client PostgreSQL ────────────────────────
# Con Homebrew i binari di postgresql@17 sono keg-only (non in PATH).
if ! command -v pg_dump >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
    if [[ -x "$candidate/pg_dump" ]]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Errore: pg_dump non trovato. Installa PostgreSQL (es. brew install postgresql@17)." >&2
  exit 1
fi

# ── Nome del database dal URL (per il nome del file) ────────────
DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
if [[ -z "$DB_NAME" ]]; then
  echo "Errore: impossibile ricavare il nome del database da DATABASE_URL" >&2
  exit 1
fi

# ── File di destinazione ────────────────────────────────────────
OUTPUT="${1:-$REPO_ROOT/database/backups/${DB_NAME}-$(date +%Y%m%d-%H%M%S).dump}"
mkdir -p "$(dirname "$OUTPUT")"

print_header "Esportazione completa del database"

echo "Database : $DB_NAME"
echo "Destino  : $OUTPUT"
echo ""

pg_dump --format=custom --file="$OUTPUT" "$DATABASE_URL"

SIZE=$(du -h "$OUTPUT" | cut -f1)
print_header "Esportazione completata"
echo "File creato: $OUTPUT ($SIZE)"
echo ""
echo "Per ripristinare questo dump al posto del database esistente:"
echo "  bash scripts/db-import.sh \"$OUTPUT\""
echo ""
