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

print_header "Verifiche preliminari"

# ── Preflight 1: il ruolo può creare database? ──────────────────
# Il check va fatto PRIMA del drop: senza CREATEDB il database verrebbe
# eliminato e non ricreato, lasciando il sistema senza database.
CREATEDB_OK=$(psql "$MAINT_URL" -t -A -c \
  "SELECT rolcreatedb FROM pg_roles WHERE rolname = '$DB_USER';" 2>/dev/null || echo "f")
if [[ "$CREATEDB_OK" != "t" ]]; then
  echo "ERRORE: il ruolo \"$DB_USER\" non ha il privilegio CREATEDB." >&2
  echo "Concedilo con un superuser PRIMA di rilanciare questo script:" >&2
  echo "  sudo -u postgres psql -c \"ALTER ROLE $DB_USER CREATEDB;\"" >&2
  exit 1
fi

# ── Preflight 2: estensione PostGIS (richiede il superuser) ─────
# Il dump contiene CREATE EXTENSION postgis: creabile SOLO da un
# superuser. Se il ruolo non è superuser, l'estensione viene pre-creata
# (subito dopo la ricreazione del database, PRIMA del restore) via
# sudo -u postgres quando possibile; altrimenti viene mostrato il
# comando da eseguire manualmente.
ensure_postgis() {
  local TARGET_URL="${PROTOCOL}://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${TARGET_DB}"
  if psql "$TARGET_URL" -t -A -c "SELECT 1 FROM pg_extension WHERE extname = 'postgis';" 2>/dev/null | grep -q 1; then
    return 0
  fi
  # Il ruolo app è superuser (sviluppo locale)? Prova direttamente.
  if psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null 2>&1; then
    return 0
  fi
  # Server di produzione (script eseguito come root): sudo verso postgres.
  if command -v sudo >/dev/null 2>&1 && \
     sudo -n -u postgres psql -d "$TARGET_DB" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null 2>&1; then
    return 0
  fi
  echo "ERRORE: impossibile creare l'estensione \"postgis\" (richiede il superuser)." >&2
  echo "Esegui manualmente e poi rilancia questo script:" >&2
  echo "  sudo -u postgres psql -d \"$TARGET_DB\" -c \"CREATE EXTENSION IF NOT EXISTS postgis;\"" >&2
  exit 1
}

print_header "Ricreazione del database"

# Se il database esiste, è VUOTO e ha già postgis, è il residuo di un
# run precedente interrotto dal hint "CREATE EXTENSION" (eseguito
# manualmente dal superuser): si prosegue direttamente con il restore,
# senza ricrearlo (ricrearlo cancellerebbe l'estensione appena aggiunta).
TARGET_URL="${PROTOCOL}://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${TARGET_DB}"
DB_EXISTS=$(psql "$MAINT_URL" -t -A -c \
  "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB';" 2>/dev/null || echo "")
RESUME_RESTORE=0
if [[ "$DB_EXISTS" == "1" ]]; then
  HAS_POSTGIS=$(psql "$TARGET_URL" -t -A -c \
    "SELECT count(*) FROM pg_extension WHERE extname = 'postgis';" 2>/dev/null || echo "0")
  # "Vuoto" = nessuna tabella/vista utente in public: gli oggetti creati
  # da PostGIS (spatial_ref_sys, geography_columns, geometry_columns)
  # appartengono all'estensione (pg_depend deptype 'e') e non contano.
  TABLE_COUNT=$(psql "$TARGET_URL" -t -A -c \
    "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d
                       WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
                         AND d.deptype = 'e');" 2>/dev/null || echo "-1")
  if [[ "$HAS_POSTGIS" == "1" && "$TABLE_COUNT" == "0" ]]; then
    echo "Database \"$TARGET_DB\" già ricreato e con postgis: proseguo con il restore."
    RESUME_RESTORE=1
  fi
fi

if [[ "$RESUME_RESTORE" != "1" ]]; then
  # Termina le connessioni attive (il backend dev può essere collegato)
  psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" >/dev/null

  psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";" >/dev/null
  psql "$MAINT_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TARGET_DB\" OWNER \"$DB_USER\";" >/dev/null
  echo "Database \"$TARGET_DB\" ricreato."

  # L'estensione deve esistere PRIMA del restore: il dump contiene
  # CREATE EXTENSION IF NOT EXISTS (no-op se già presente, senza errori
  # di permessi) ma fallirebbe se mancante e creato dal ruolo non-superuser.
  ensure_postgis
  echo "Estensione postgis presente."
fi

print_header "Ripristino del dump"

# spatial_ref_sys appartiene all'estensione PostGIS (creata dal
# superuser): i suoi dati standard non vanno ripristinati dal ruolo app.
# Si esclude dal TOC il solo COPY DATA di quella tabella (il resto del
# dump — schema, dati utente, indici — è ripristinato integralmente).
TOC_LIST="$(mktemp)"
pg_restore -l "$DUMP_FILE" | grep -v 'TABLE DATA [^ ]* spatial_ref_sys' > "$TOC_LIST"

pg_restore --dbname="$TARGET_DB" --host="$DB_HOST" --port="$DB_PORT" \
  --username="$DB_USER" --no-owner --no-privileges --no-comments \
  --exit-on-error --use-list="$TOC_LIST" \
  "$DUMP_FILE"
rm -f "$TOC_LIST"

# ── Verifica ────────────────────────────────────────────────────
TABLES=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo ""
echo "Tabelle presenti nello schema public: $TABLES"

print_header "Importazione completata"
echo "Il database \"$TARGET_DB\" è stato sostituito con il contenuto del dump."
echo "Se il backend è in esecuzione, non è necessario riavviarlo."
echo ""
