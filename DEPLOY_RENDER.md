# Deploy on Render

The app can be connected to a private GitHub repository and deployed as a Render Blueprint from `render.yaml`. The Blueprint uses a paid Starter web service because SQLite needs a persistent disk. Keep one service instance: login sessions are stored in memory and are cleared on restart.

## Before deploying

- Create the GitHub repository from this app folder only. Do not publish the Desktop folder.
- Confirm `.gitignore` excludes the local SQLite database and backups. Do not upload either database file to GitHub.
- In Render, set `CHANG_MATERIAL_INITIAL_ADMIN_PASSWORD` to a new, strong secret. Do not reuse a demo password.
- The service cannot start on an empty disk until its database schema and initial data are initialized. Do not point this service at the existing local database.

## Initialize a new Render database

After the Blueprint creates the service and persistent disk, use the Render Shell for that service and verify that `CHANG_MATERIAL_DB_PATH` is `/var/data/chang_material_control.db`. On this new, empty database only, run the migration with the confirmation variables and then seed:

```sh
CHANG_MATERIAL_MIGRATION_CONFIRM=YES CHANG_MATERIAL_MIGRATION_BACKUP_VERIFIED=YES npm run migrate
npm run seed
```

In production, the seed creates the application’s base roles, restaurants, materials, and checklist data, plus only an `admin` user using `CHANG_MATERIAL_INITIAL_ADMIN_PASSWORD`. Sign in as `admin`, then create employee accounts from the Admin panel. Never run these initialization commands against a database containing business data without a verified backup and an explicit review.

Render will provide the shareable HTTPS URL after the service starts successfully. The local SQLite file is not migrated or uploaded by this setup.