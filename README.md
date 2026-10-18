# CHANG Material Control

Web app for shared material checks, restaurant assignments, reports, and notifications.

## Free hosted deployment

The app can run as a Render free web service with a Neon PostgreSQL database. The database is external to the web service so application data survives Render restarts and sleep periods. Free services can sleep while idle and take longer to respond on the first request after waking.

1. Create a PostgreSQL project on Neon and copy its pooled connection string (`DATABASE_URL`). Keep it private.
2. In Render, create a new Blueprint from this GitHub repository and select `render.yaml`.
3. Set the `DATABASE_URL` secret to the Neon connection string.
4. Set `CHANG_MATERIAL_INITIAL_ADMIN_PASSWORD` to a unique password with at least 12 characters.
5. Deploy. On first startup the app creates the schema and an `admin` account. Sign in with the password from step 4, then create individual accounts and change any seeded credentials before sharing the link.

The first production startup intentionally creates only the admin account. Demo restaurant accounts are created only in development mode. Subsequent startups detect existing business data and skip seeding.

## Local run

Requires Node.js 20 or later and PostgreSQL. Set `DATABASE_URL`, then run `npm ci` and `npm start`. For a fresh local database, the development seed password is `Admin@123`; change it before using real data.
