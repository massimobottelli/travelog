# Travelog

Travelog is a self-hosted application for organizing a personal photo collection into trips.

It scans a photo archive stored on the filesystem, extracts metadata from photos, associates photos with geographic locations, and automatically identifies trips.

The application is designed for personal use.

## Features

* scanning a photo directory;
* extracting photo metadata from JPEG and HEIC/HEIF files;
* storing photo metadata in PostgreSQL;
* reverse-geocoding photo coordinates via the external Geoapify API (with a persistent geocoding cache);
* identifying visits and trips from photo dates and locations;
* viewing trips and their daily/location details;
* manually renaming trips;
* manually changing trip dates;
* splitting trips;
* merging two or more trips;
* keeping the history of trip operations;
* configuring geographic exclusion zones;
* configuring trip-detection thresholds;
* explicitly recalculating data after configuration changes.

Photos themselves are not served or displayed by the application .

## Project documentation

The documentation is divided into four complementary documents:

* [`doc/functional-requirements-mvp1.md`](doc/functional-requirements-mvp1.md) — functional requirements and behavior.
* [`doc/technical-design-mvp1.md`](doc/technical-design-mvp1.md) — technical architecture and implementation decisions.
* [`doc/implementation-plan-mvp1.md`](doc/implementation-plan-mvp1.md) — implementation phases and tasks.
* [`.clinerules`](.clinerules) — rules and working conventions for AI-assisted development with Cline.
* [`openapi/openapi.yaml`](openapi/openapi.yaml) — REST API contract.

The functional requirements are the source of truth for application behavior.

The technical design defines how that behavior is implemented.

The OpenAPI document defines the API contract between frontend and backend.

## Architecture

Travelog is composed of separate frontend and backend applications.

```text
┌───────────────────────┐
│      React + Vite     │
│        Frontend       │
└───────────┬───────────┘
            │ REST / OpenAPI
            ▼
┌───────────────────────┐
│ Node.js + TypeScript  │
│       Express         │
│       Backend         │
└───────┬─────────┬─────┘
        │         │
        │         └──────────────┐
        ▼                        ▼
┌───────────────┐       ┌──────────────────┐
│ PostgreSQL    │       │ Photo archive    │
│ (+ ExifTool,  │       │  / filesystem    │
│ Geoapify API) │       │                  │
└───────────────┘       └──────────────────┘
```

The backend also runs the background scanning process.

Scanning is asynchronous and can be monitored through the REST API using polling.

## Technology stack

### Backend

* Node.js
* TypeScript
* Express
* REST
* OpenAPI 3.1
* JSON Schema/OpenAPI validation
* Drizzle ORM
* PostgreSQL
* `exiftool` as an external process
* Geoapify reverse geocoding API (external HTTP service)

### Frontend

* React
* Vite
* TypeScript
* browser `fetch`
* generated TypeScript types from OpenAPI

No additional client-side data-fetching/state-management framework is required .

### Testing

* unit tests for domain and application logic;
* integration tests for database and API behavior.

End-to-end browser testing is not required initially.

### Infrastructure

PostgreSQL/PostGIS runs directly on the development server.

The photo archive is provided through a filesystem path.

## Configuration

Deployment/runtime configuration is provided through environment variables in
a single `.env` file at the repository root (see [`.env.example`](.env.example)):
database connection, HTTP server settings, ExifTool path and the optional
Geoapify API key.

Functional application settings (photo archive root, trip-detection
thresholds, exclusion zones) are **not** environment variables: they are
persisted in the PostgreSQL `settings` table and managed from the app
Settings page.

See [`doc/deployment-mvp1.md`](doc/deployment-mvp1.md) for the full Debian
deployment procedure.

## Build and deployment

### Prerequisites

* Node.js 22 LTS (the workspaces declare `node >= 18` as minimum engine)
* PostgreSQL with the PostGIS extension
* `exiftool` (Debian/Ubuntu package: `libimage-exiftool-perl`)

On Debian/Ubuntu the provisioning script automates the system setup:

```bash
scripts/setup-linux.sh
```

### Installing dependencies

The repository is an npm workspace containing `backend` and `frontend`:

```bash
npm ci
```

### Building

A single command builds both applications — the backend with `tsc` and the
frontend with `tsc -b && vite build`:

```bash
npm run build
```

Output:

* backend → `backend/dist/`
* frontend → `frontend/dist/` (static files, served by Nginx in production)

### Database migrations

The database schema is managed through versioned Drizzle migrations stored in
the repository. Apply them before starting the application:

```bash
npm run db:migrate --workspace=@travelog/backend
# equivalent to: cd backend && npm run db:migrate
```

To create a new migration after changing the Drizzle schema:

```bash
npm run db:generate --workspace=@travelog/backend
```

### Running in development

```bash
cp .env.example .env   # fill in DATABASE_URL and the other values
npm run dev            # backend (tsx watch) + frontend (Vite dev server)
```

The API is served under `/api`; the Vite dev server proxies REST calls to the
backend during development.

### Running in production (Debian)

The target deployment is a Debian server with PostgreSQL/PostGIS, Nginx and
systemd. The full step-by-step procedure — system prerequisites, PostgreSQL
setup, NAS mount, `.env` configuration, migrations, systemd unit and Nginx
reverse proxy — is documented in
[`doc/deployment-mvp1.md`](doc/deployment-mvp1.md). Summary:

```bash
cd /opt/travelog
npm ci
npm run build
npm run db:migrate --workspace=@travelog/backend

# systemd service (backend on localhost:3000)
sudo cp deploy/travelog.service /etc/systemd/system/travelog.service
sudo systemctl daemon-reload
sudo systemctl enable --now travelog

# Nginx: serves frontend/dist/ on / and reverse-proxies /api/
sudo cp deploy/nginx-travelog.conf /etc/nginx/sites-available/travelog
sudo ln -sf /etc/nginx/sites-available/travelog /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Nginx serves a single origin: the static React build on `/` and the REST API
in reverse proxy under `/api/`, so no CORS configuration is needed.

Logs are written to stdout/stderr and forwarded by systemd to journald:

```bash
journalctl -u travelog -f
```

After the first start, configure the photo archive root and the trip-detection
thresholds from the app Settings page (these are functional settings stored in
the database, not environment variables).

A post-deployment smoke test is available:

```bash
scripts/smoke-test.sh http://localhost/api
```

### Updating an existing installation

```bash
cd /opt/travelog
scripts/update-prod.sh   # git pull, npm ci, build, migrations, service restart
```

Or manually: `git pull`, `npm ci`, `npm run build`,
`npm run db:migrate --workspace=@travelog/backend`,
`sudo systemctl restart travelog`.

## Database

Travelog uses PostgreSQL.

Database schema changes are managed through versioned Drizzle migrations stored in the repository.

The application domain model is persisted in PostgreSQL rather than being derived directly from filesystem state.

Reverse geocoding is performed through the external Geoapify API during photo
scans, with results cached persistently in the `geocoding_cache` table.
No offline geographic datasets are imported.

## Photo scanning

Scanning is performed asynchronously by a Node.js background process.

The scanner is designed to be:

* idempotent;
* restartable;
* safe to run repeatedly;
* protected against concurrent scans.

The scanner invokes `exiftool` as an external process to extract metadata.

Support:

* JPEG;
* HEIC/HEIF.

Photos with incomplete required EXIF metadata are recorded appropriately and do not cause the entire scan to fail.

Individual file errors are isolated from the rest of the scan whenever possible.

## API

The backend exposes a REST API under:

```text
/api
```

The API contract is defined exclusively by:

```text
openapi/openapi.yaml
```

The OpenAPI contract follows a contract-first approach.

TypeScript types used by the frontend are generated from OpenAPI rather than manually duplicated.

API errors use a uniform structure defined by OpenAPI.

## Authentication

No authentication or authorization.

The application is intended to run in a trusted environment.

