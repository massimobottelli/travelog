#!/usr/bin/env bash
#
# Travelog MVP1 — aggiornamento dell'installazione di produzione.
#
# Automatizza la procedura descritta in doc/deployment-mvp1.md §11:
#
#   1. clone/pull del repository aggiornato (preserva il .env esistente)
#   2. npm ci
#   3. npm run build        (backend tsc + frontend Vite)
#   4. database migrations  (workspace backend)
#   5. riavvio del servizio systemd "travelog"
#   6. verifica che il backend risponda su /api/health
#
# Lo script va eseguito SUL SERVER di produzione:
#
#   bash /opt/travelog/scripts/update-prod.sh
#
# oppure dal proprio client via SSH:
#
#   ssh <server> 'bash /opt/travelog/scripts/update-prod.sh'
#
# Variabili d'ambiente (override opzionale):
#
#   TRAVELOG_DIR     directory di installazione (default: /opt/travelog)
#   TRAVELOG_REMOTE  remote git da usare       (default: origin)
#   TRAVELOG_BRANCH  branch da deployare       (default: main)
#   TRAVELOG_REPO    URL del repository (necessario solo se la directory
#                    non esiste ancora e deve essere clonata)
#
set -euo pipefail

APP_DIR="${TRAVELOG_DIR:-/opt/travelog}"
REMOTE="${TRAVELOG_REMOTE:-origin}"
BRANCH="${TRAVELOG_BRANCH:-main}"
REPO_URL="${TRAVELOG_REPO:-}"

log() { printf '\n[update-prod] %s\n' "$*"; }
fail() { printf '\n[update-prod] ERRORE: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------
# 1. Repository: clone se assente, altrimenti reset al branch remoto
# ---------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    log "Aggiorno il repository in $APP_DIR ($REMOTE/$BRANCH)"
    git fetch "$REMOTE" --prune
    # Il .env non è versionato: non viene toccato da reset --hard.
    git reset --hard "$REMOTE/$BRANCH"
    # Il .env non è versionato: non viene toccato da reset --hard.
    # update-prod.sh è escluso dal clean per evitare che si elimini
    # da solo se non fosse ancora tracciato nel branch remoto.
    git clean -fd --exclude .env --exclude scripts/update-prod.sh
else
    [ -n "$REPO_URL" ] || fail "directory $APP_DIR non esiste: impostare TRAVELOG_REPO per il clone iniziale"
    log "Clono il repository $REPO_URL in $APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

[ -f .env ] || fail "manca $APP_DIR/.env: completare prima la configurazione iniziale (doc/deployment-mvp1.md §5)"

# ---------------------------------------------------------------
# 2-3. Dipendenze e build
# ---------------------------------------------------------------
log "Installo le dipendenze (npm ci)"
npm ci

log "Compilo backend e frontend"
npm run build

# ---------------------------------------------------------------
# 4. Database migrations (versionate, workspace backend)
# ---------------------------------------------------------------
log "Applico le database migrations"
npm run db:migrate --workspace=@travelog/backend

# ---------------------------------------------------------------
# 5. Riavvio del servizio
# ---------------------------------------------------------------
log "Riavvio il servizio systemd 'travelog'"
sudo systemctl restart travelog
systemctl is-active --quiet travelog || fail "il servizio travelog non è attivo dopo il restart"

# ---------------------------------------------------------------
# 6. Verifica che il backend sia realmente operativo: il processo
#    impiega qualche secondo ad avviarsi (connessione al pool
#    PostgreSQL), quindi si attende che /api/health risponda.
# ---------------------------------------------------------------
log "Attendo che il backend risponda su /api/health"
READY=0
for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null http://localhost/api/health 2>/dev/null; then
        READY=1
        break
    fi
    sleep 1
done
[ "$READY" = "1" ] || fail "il backend non risponde su /api/health entro 30s (vedi: journalctl -u travelog)"

log "Aggiornamento completato: $(git rev-parse --short HEAD) ($BRANCH)"
log "Log del servizio: journalctl -u travelog -f"