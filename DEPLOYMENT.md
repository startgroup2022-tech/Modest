# Deployment — Attention Modest Fashion

Production deployment target: **cPanel → "Setup Node.js App" (Application Manager)**,
MySQL 8 / MariaDB 10.4+, Node.js 20 LTS or newer.

The app is a single Next.js 15 (App Router) server. There is no Docker, no
Kubernetes, and no external service dependency beyond the MySQL database, so it
runs on standard shared/dedicated cPanel hosting.

---

## 1. Server prerequisites

| Item | Value |
| --- | --- |
| Node.js version | `>= 20.9.0` (set **20.x LTS** in cPanel) |
| Application root | e.g. `/home/<cpanel_user>/attention` |
| Application URL | `https://attention-modestfashion.com` |
| Startup file | `server.js` (see below) or `node_modules/next/dist/bin/next` |
| Database | MySQL 8 / MariaDB 10.4+ |

### MySQL

1. In cPanel → **MySQL Databases**, create a database and a user, and grant the
   user all privileges on it.
2. Note the host — on cPanel it is usually `localhost` (port `3306`).
3. The connection string format is
   `mysql://USER:PASSWORD@HOST:PORT/DATABASE`.

---

## 2. Environment variables

Set these in cPanel → **Setup Node.js App → Environment Variables**. Do **not**
commit real values; `.env` is git-ignored.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `mysql://user:pass@localhost:3306/attention` |
| `AUTH_SECRET` | yes | Long random value. `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://attention-modestfashion.com` (no trailing slash) |
| `PORT` | no | Provided by cPanel/Passenger automatically |
| `TAPP_ENV` | no | `sandbox` or `live` |
| `TAPP_BASE_URL` | no | TAPP API base, e.g. `https://api.tapp.sa` |
| `TAPP_MERCHANT_ID` | no | TAPP merchant id (or set in Admin → Settings → Payments) |
| `TAPP_API_KEY` | no | TAPP API key |
| `TAPP_WEBHOOK_SECRET` | no | TAPP webhook signing secret |
| `BENEFIT_ALIAS` / `BENEFIT_ACCOUNT_NAME` / `BENEFIT_ACCOUNT_NUMBER` | no | BenefitPay details (or admin setting) |
| `BANK_NAME` / `BANK_IBAN` / `BANK_ACCOUNT_NAME` | no | Bank transfer details (or admin setting) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seeding only | Used by `npm run db:seed` |

Payment credentials can be supplied either through the environment or the Admin
UI. Values entered in **Admin → Settings → Payments → TAPP configuration** take
precedence over the environment variables, and are stored server-side only.

---

## 3. Build & start commands

In the cPanel Node.js App configuration:

| Field | Command |
| --- | --- |
| Install / NPM install | `npm ci` |
| Build | `npm run build` |
| Start (Application startup file) | `server.js` |

`npm ci` triggers `postinstall` → `prisma generate`, which is required before
`next build`.

Create `server.js` in the application root (cPanel/Passenger starts this file
rather than `next start`):

```js
// cPanel / Passenger entrypoint.
const { createServer } = require('http');
const next = require('next');

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port);
});
```

Restart the application after every deploy from **Setup Node.js App → Restart**.

---

## 4. Database schema

The schema is managed with Prisma. A committed baseline migration lives in
`prisma/migrations/0_init`.

**Fresh database** (new install):

```bash
npx prisma migrate deploy   # creates the schema from the committed migration
npm run db:seed             # creates roles, permissions, the admin user and demo data
```

**Existing database** that was already created with `prisma db push` (baseline
it once, then use migrations thereafter):

```bash
npx prisma migrate resolve --applied 0_init
```

After every future schema change, generate a new migration locally with
`npx prisma migrate dev` and commit it; production only ever runs
`npx prisma migrate deploy`.

If the database user lacks `CREATE DATABASE` rights, create the database in
cPanel first and only run `migrate deploy` (never `migrate dev` on production).

---

## 5. Static & uploaded media

- Product images served from `/media/...` are static assets in
  `public/media/`. Deploy them with the release.
- Runtime uploads (if enabled) are written under `public/uploads/`, which is
  git-ignored. Ensure the directory exists and is writable by the app user, and
  include it in your backup routine.
- Next.js image optimization needs write access to the `.next` cache directory.

---

## 6. SSL, proxy & rewrite requirements

- Terminate TLS at cPanel/AutoSSL and force HTTPS. The app already sends
  `Strict-Transport-Security`.
- Forward the real client IP: Passenger sets `X-Forwarded-For`, which the app
  uses for rate limiting. Ensure the proxy passes it through unmodified.
- The `/api/webhooks/tapp` endpoint must be reachable over HTTPS from TAPP.
  Point the TAPP dashboard webhook at
  `https://attention-modestfashion.com/api/webhooks/tapp`.
- No custom rewrite rules are needed; all routing is handled by Next.js
  middleware and the App Router.

---

## 7. Cron / scheduled tasks

None are required for the storefront. Optional:

- A cron hitting `GET /api/health` every 5 minutes for uptime monitoring.

---

## 8. Post-deploy checklist

1. `GET /api/health` returns `{"status":"ok","database":"up"}`.
2. Sign in to `https://<domain>/en/admin` with the seeded admin account and
   immediately change the password (Admin → Employees) and set
   `SEED_ADMIN_PASSWORD` out of the environment if not needed.
3. Configure store details, currencies, shipping methods and payment methods in
   Admin → Settings.
4. Verify checkout with each enabled method; confirm the flow is rejected with a
   clear message when a method is disabled.
5. Confirm TAPP webhook deliveries arrive and are accepted in the Payment log
   (unsigned requests must be rejected with HTTP 401).
