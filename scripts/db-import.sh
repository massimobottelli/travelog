#!/usr/bin/env bash
#
# Travelog MVP1 — importazione completa di un database al posto di
# quello esistente.
#
# RICREAZIONE TOTALE: il database di destinazione viene DROPPATO e
# ricreato da zero, quindi il dump viene ripristinato interamente
# (schema, dati, vincoli, indici PostGIS ed estensioni). Tutti i dati
# attuali del database di destinazione andranno persi.
#
# Uso:
#   bash scripts/db-import.sh <file-dump> [--database <nome>]
#
#   <file-dump>   file .dump prodotto da scripts/db-export.sh
#   --database    nome del database di destinazione (default: quello
#                 ricavato da DATABASE_URL); consentito solo per
#                 cambiare il nome, la connection resta quella di .env
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

usage() {
  echo "Uso: bash scripts/db-import.sh <file-dump> [--database <nome>]" >&2
  exit 1
}

# ── Argomenti ───────────────────────────────────────────────────
DUMP_FILE=""
TARGET_DB_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --database)
      TARGET_DB_OVERRIDE="${2:-}"
      [[ -z "$TARGET_DB_OVERRIDE" ]] && usage
      shift 2
      ;;
    *)
      [[ -n "$DUMP_FILE" ]] && usage
      DUMP_FILE="$1"
      shift
      ;;
  esac
done

if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Errore: file dump non specificato o inesistente." >&2
  usage
fi
DUMP_FILE="$(cd "$(dirname "$DUMP_FILE")" && pwd)/$(basename "$DUMP_FILE")"

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
if ! command -v psql >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
    if [[ -x "$candidate/psql" ]]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi
if ! command -v psql >/dev/null 2>&1 || ! command -v pg_restore >/dev/null 2>&1; then
  echo "Errore: psql/pg_restore non trovati. Installa PostgreSQL (es. brew install postgresql@17)." >&2
  exit 1
fi

# ── Scomposizione del URL di destinazione ───────────────────────
# Formato atteso: postgresql://utente:password@host:porta/nome_db?params
URL="${DATABASE_URL%%\?*}"
PROTOCOL="${URL%%://*}"
REST="${URL#*://}"
CREDENTIALS="${REST%%@*}"
HOSTPORT="${REST#*@}"
TARGET_DB="${HOSTPORT##*/}"
HOSTPORT="${HOSTPORT%%/*}"
DB_USER="${CREDENTIALS%%:*}"
DB_PASSWORD="${CREDENTIALS#*:}"
DB_HOST="${HOSTPORT%%:*}"
[[ "$HOSTPORT" == *:* ]] && DB_PORT="${HOSTPORT#*:}" || DB_PORT="5432"

if [[ "$DB_PASSWORD" == "$CREDENTIALS" ]]; then
  DB_PASSWORD=""
fi

if [[ -n "$TARGET_DB_OVERRIDE" ]]; then
  TARGET_DB="$TARGET_DB_OVERRIDE"
fi
if [[ -z "$TARGET_DB" ]]; then
  echo "Errore: impossibile ricavare il nome del database da DATABASE_URL" >&2
  exit 1
fi

# URL verso il database di manutenzione "postgres" (per drop/create)
MAINT_URL="${PROTOCOL}://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"
export PGPASSWORD="$DB_PASSWORD"

print_header "Importazione completa del database"

echo "Dump sorgente   : $DUMP_FILE"
echo "Host:porta      : $DB_HOST:$DB_PORT"
echo "Database target : $TARGET_DB"
echo ""
echo "ATTENZIONE: il database \"$TARGET_DB\" sarà COMPLETAMENTE SOSTITUITO."
echo "Tutti i dati attuali andranno persi."
echo ""
read -r -p "Confermi l'importazione? (scrivere SÌ per procedere): " CONFIRM
if [[ "$CONFIRM" != "SÌ" && "$CONFIRM" != "SI" && "$CONFIRM" != "si" && "$CONFIRM" != "s" ]]; then
  echo "Importazione annullata."
  exit 0
fi

print_header "Ricreazione del database"

# Termina le connessioni attive (il backend dev può essere collegato)
psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" >/dev/null

psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";" >/dev/null
psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TARGET_DB\" OWNER \"$DB_USER\";" >/dev/null
echo "Database \"$TARGET_DB\" ricreato."

print_header "Ripristino del dump"

pg_restore --dbname="$TARGET_DB" --host="$DB_HOST" --port="$DB_PORT" \
  --username="$DB_USER" --no-owner --no-privileges --exit-on-error \
  "$DUMP_FILE"

# ── Verifica ────────────────────────────────────────────────────
TABLES=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo ""
echo "Tabelle presenti nello schema public: $TABLES"

print_header "Importazione completata"
echo "Il database \"$TARGET_DB\" è stato sostituito con il contenuto del dump."
echo "Se il backend è in esecuzione, non è necessario riavviarlo."
echo ""
