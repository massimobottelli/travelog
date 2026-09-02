# Deployment — Travelog MVP1 (Debian)

Procedura di deployment per il server Debian target del progetto.

> **Nota postGIS/Geoapify:** MVP1 non utilizza query spaziali né dataset
> geografici importati: il reverse geocoding avviene tramite l'API esterna
> Geoapify (technical design §24). PostGIS è richiesto solo perché la
> migration iniziale (0000) esegue `CREATE EXTENSION postgis` (già presente
> nelle installazioni esistenti); nessun codice applicativo lo usa.

---

## 1. Prerequisiti di sistema

```bash
sudo apt-get update
sudo apt-get install -y curl gnupg ca-certificates \
    postgresql postgresql-contrib \
    postgresql-17-postgis-3 \
    nginx libimage-exiftool-perl
```

Node.js 22 LTS via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    | tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update && sudo apt-get install -y nodejs
```

Lo script `scripts/setup-linux.sh` automatizza tutti questi passaggi.

---

## 2. Layout di installazione

```text
/opt/travelog            ← repository (owner: travelog-service)
├── backend/dist/        ← backend compilato (npm run build)
├── frontend/dist/       ← static build React/Vite
├── database/migrations/ ← migration versionate
├── deploy/              ← systemd unit + Nginx site canonici
└── .env                 ← configurazione (non versionato)
```

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin travelog-service
sudo mkdir -p /opt/travelog
sudo rsync -a --exclude node_modules --exclude .git /path/to/travelog/ /opt/travelog/
```

---

## 3. PostgreSQL

```bash
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "CREATE USER travelog WITH PASSWORD '<password>';"
sudo -u postgres psql -c "CREATE DATABASE travelog OWNER travelog;"
sudo -u postgres psql -d travelog -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Se il database esiste già ma con owner diverso (errore tipico:
# "permission denied for database" durante db:migrate):
sudo -u postgres psql -c "ALTER DATABASE travelog OWNER TO travelog;"
sudo -u postgres psql -d travelog -c "GRANT ALL ON SCHEMA public TO travelog;"
```

> Il database deve essere di proprietà di `travelog`: le migration creano le
> tabelle con l'utente della `DATABASE_URL`.

## 4. NAS

Montare il NAS in una directory locale (es. `/mnt/travelog/photos`) via SMB o
NFS, rendendola leggibile a `travelog-service`. Travelog accede al filesystem
**in sola lettura** e non modifica mai le fotografie.

Il percorso della libreria fotografica (photo root) è una **configurazione
funzionale nel database**: si imposta dall'app (Impostazioni → Percorso foto)
dopo il primo avvio — non esiste la variabile d'ambiente
`TRAVELOG_PHOTO_ROOT` (migration 0012, technical design §8).

## 5. Configurazione

```bash
cd /opt/travelog
cp .env.example .env
```

Variabili principali (vedi `.env.example` e technical design §8):

| Variabile       | Note                                              |
| --------------- | ------------------------------------------------- |
| `DATABASE_URL`  | `postgresql://travelog:<password>@localhost:5432/travelog` |
| `HOST` / `PORT` | `0.0.0.0` / `3000`                                |
| `CORS_ORIGIN`   | Origine frontend (dietro Nginx: stessa origin, CORS irrilevante) |
| `EXIFTOOL_PATH` | `exiftool`                                        |
| `GEOCOAPIFY_API_KEY` | chiave Geoapify (opzionale: senza chiave il geocoding viene saltato ma le scansioni completano) |

## 6. Build e migrations

```bash
cd /opt/travelog
npm ci
npm run build          # backend (tsc) + frontend (Vite)
npm run db:migrate --workspace=@travelog/backend   # applica le migrations versionate
```

> **Nota:** lo script `db:migrate` è definito nel workspace backend
> (`backend/package.json`); il comando sopra usa `--workspace` per eseguirlo
> dalla root `/opt/travelog`. In alternativa: `cd backend && npm run db:migrate`.

## 7. systemd

```bash
sudo cp deploy/travelog.service /etc/systemd/system/travelog.service
sudo systemctl daemon-reload
sudo systemctl enable --now travelog
```

Il backend scrive i log su stdout/stderr; systemd li inoltra a **journald**:

```bash
journalctl -u travelog -f
```

## 8. Nginx

```bash
sudo cp deploy/nginx-travelog.conf /etc/nginx/sites-available/travelog
sudo ln -sf /etc/nginx/sites-available/travelog /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Single origin: `/` serve il build statico React, `/api/` è in reverse proxy
verso Express su `localhost:3000`. Nessuna configurazione CORS necessaria.

## 9. Prima configurazione applicativa

1. Aprire `http://<server>/` nel browser.
2. **Impostazioni → Percorso foto**: inserire il photo root (percorso assoluto,
   directory esistente, es. `/mnt/travelog/photos`).
3. Impostare le soglie e le zone di esclusione (Impostazioni).

## 10. Smoke test

Con il backend in esecuzione:

```bash
# Solo API (health, settings, trips)
scripts/smoke-test.sh http://localhost/api

# Smoke completo con scansione reale (polling fino a stato terminale)
scripts/smoke-test.sh http://localhost/api <cartella-relativa-al-photo-root>
```

Verifiche manuali aggiuntive:

* `journalctl -u travelog` mostra gli eventi strutturati
  (`scan.started`, `scan.completed`, …);
* lo storico scansioni è visibile nella pagina Scansioni;
* un tentativo di seconda scansione durante una in corso risponde `409`.

---

## 11. Aggiornamento di una installazione esistente

```bash
cd /opt/travelog
git pull                      # o rsync della nuova release
npm ci
npm run build
cd backend && npm run db:migrate && cd ..
sudo systemctl restart travelog
scripts/smoke-test.sh http://localhost/api
```

---

## 12. Riferimenti

* `doc/functional-requirements-mvp1.md` — requisiti funzionali
* `doc/technical-design-mvp1.md` — architettura (§56 Nginx, §57 systemd, §69 deployment layout)
* `deploy/travelog.service` — unit systemd canonico
* `deploy/nginx-travelog.conf` — sito Nginx canonico
* `scripts/setup-linux.sh` — provisioning automatico Debian/Ubuntu
* `scripts/smoke-test.sh` — smoke test post-deployment
