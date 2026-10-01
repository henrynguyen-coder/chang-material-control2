# CHANG MATERIAL CONTROL Deployment

This repository is packaged for a single-instance Docker host with persistent SQLite storage. It does not publish a public URL by itself.

## Prerequisites

- A Linux VPS or Docker-compatible host
- Docker Engine and Docker Compose
- A DNS name and HTTPS reverse proxy (for example, Caddy or Nginx)
- A verified backup before migrating an existing database

The app listens on port 3000 inside the container. Compose binds it to `127.0.0.1:3000`; terminate HTTPS at the reverse proxy and keep port 3000 closed to the public internet.

## Fresh Database

On a new, empty persistent volume only, run the explicit bootstrap once:

```powershell
docker compose run --rm chang-material-control node --experimental-sqlite src/database/seed.js
```

Then start the app:

```powershell
docker compose up -d --build
```

Normal startup does not seed or migrate business data. It checks the migration version and exits with an actionable error if the schema is not ready.

## Existing Database

Do not run the seed command against an existing business database. Stop the current app, verify a restorable backup, and copy the database into the persistent volume mounted at `/var/lib/chang/chang_material_control.db`.

Only after verifying that backup, run the additive migration explicitly:

```powershell
docker compose run --rm -e CHANG_MATERIAL_MIGRATION_CONFIRM=YES -e CHANG_MATERIAL_MIGRATION_BACKUP_VERIFIED=YES chang-material-control node --experimental-sqlite src/database/migrations/runner.js
```

The runner prints its resolved database path. Confirm that path before allowing the command to proceed. The application has not been migrated or deployed by preparing these files.

## Before Public Access

- Configure HTTPS and point DNS to the host.
- Change all seeded demo passwords, including `admin`, both AC/L&D demo users, and the restaurant accounts, before sharing the URL. Seed credentials are defined in `src/database/seed.js` and are public source defaults.
- Restrict firewall access to HTTPS/reverse-proxy ports; do not expose SQLite or the container port directly.
- Keep one app instance. Sessions are stored in memory and are lost on restart; the current app is not configured for horizontal scaling.
- Review authentication rate limiting and CORS policy before broad public exposure.
- Back up the persistent SQLite volume regularly and verify restore procedures.

The 24-Material import remains intentionally separate and has not been run.
