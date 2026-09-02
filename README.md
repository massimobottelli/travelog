# Travelog

Travelog is a self-hosted application for organizing a personal photo collection into trips.

It scans a photo archive stored on a NAS, extracts metadata from photos, associates photos with geographic locations, and automatically identifies trips.

The application is designed for personal use and for an MVP1 implementation focused on simplicity and reliability.

## MVP1

MVP1 provides:

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

Photos themselves are not served or displayed by the application in MVP1.

## Project documentation

The documentation is divided into four complementary documents:

* [`doc/functional-requirements-mvp1.md`](doc/functional-requirements-mvp1.md) — functional requirements and MVP1 behavior.
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
│ (+ ExifTool,  │       │      / NAS       │
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

No additional client-side data-fetching/state-management framework is required for MVP1.

### Testing

MVP1 uses:

* unit tests for domain and application logic;
* integration tests for database and API behavior.

End-to-end browser testing is not required initially.

### Infrastructure

MVP1 deliberately does not use Docker.

PostgreSQL/PostGIS runs directly on the development server.

The photo archive is provided through a filesystem path mounted from the NAS.

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

MVP1 supports:

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

MVP1 has no authentication or authorization.

The application is intended to run in a trusted environment.

## Development principles

The implementation should prioritize:

1. correctness;
2. simplicity;
3. explicit domain rules;
4. testability;
5. restartability of background processing;
6. minimal dependencies.

Avoid introducing frameworks or infrastructure that are not required by MVP1.

Do not change functional behavior defined in the functional requirements document without explicitly updating the requirements first.

## AI-assisted development

Development is performed with VS Code and Cline.

Cline must use the repository documentation as its primary source of project constraints.

Before implementing a task, Cline should read:

1. `doc/functional-requirements-mvp1.md`
2. `doc/technical-design-mvp1.md`
3. `doc/implementation-plan-mvp1.md`
4. `.clinerules`
5. `openapi/openapi.yaml` when the task concerns the API

Changes should be small, incremental, and validated with the relevant tests after each implementation step.

## Current status

MVP1 is released: all implementation phases (0–10) are complete.

* Functional behavior: [`doc/functional-requirements-mvp1.md`](doc/functional-requirements-mvp1.md)
* Technical design: [`doc/technical-design-mvp1.md`](doc/technical-design-mvp1.md)
* Deployment procedure: [`doc/deployment-mvp1.md`](doc/deployment-mvp1.md)
