# Arclight Developer Guide

This document is for developers who want to work on the Arclight panel. It covers the architecture, repository layout, local setup, testing, and the panel↔daemon protocol.

---

## Architecture in one paragraph

Arclight is a **control plane**: a browser-served Express panel (this repo) that manages game servers running inside Docker containers on remote **nodes**. Each node runs a daemon (`arclightd`, a separate repository). The panel talks to daemons over HTTP/WebSocket signed with **HMAC** headers (`X-Arclight-Timestamp`, `X-Arclight-Signature`, `X-Arclight-Nonce`, `X-Arclight-Payload-Version`, `X-Arclight-Digest`) and `Basic Arclight:<node-key>` auth. Data lives in a SQLite database via Prisma.

```
Browser ──▶ Express panel (this repo)
                 │  HMAC-signed HTTP/WS
                 ▼
            arclightd daemon (Docker, files, SFTP)  ──▶ game server containers
```

---

## Repository layout

| Path | Purpose |
|------|---------|
| `src/app.ts` | Express app entrypoint, middleware, route mounting |
| `src/modules/` | Feature modules (`admin/`, `user/`, `api/`, `auth/`, `core/`, `realtime/`) |
| `src/handlers/` | Shared services: settings, addons, sessions, updater, scheduler, daemon request client |
| `src/handlers/utils/` | Core utilities: HMAC daemon client, SFTP, backups, MySQL provisioning, SSRF guard |
| `src/tui/` | Terminal UI + headless runner (`bun src/tui/index.ts`); excluded from the main tsconfig |
| `src/types/` | Global type declarations |
| `views/` | EJS templates (`components/`, `user/`, `admin/`, `auth/`, `api/`) |
| `public/` | Static assets, CSS, browser JS (`javascript/shared/` has `al-*` controllers) |
| `storage/` | Runtime data: SQLite `dev.db`, lang packs, addons |
| `storage/lang/` | i18n string tables (10 locales, keyed JSON) |
| `storage/addons/` | Bundled addons (e.g. `arclight-cloud`, `modrinth`) |
| `prisma/` | Schema + SQLite migrations |
| `tests/` | Vitest unit tests (mirror `src/` structure) |
| `smoke/` | Playwright smoke suite (separate package) |
| `docs/` | Architecture, API spec, addon system, security docs |

---

## Prerequisites

- Node.js **22+** (the project targets `>=22`)
- pnpm 11 (`corepack enable` or `npm i -g pnpm`)
- Docker (for running actual game servers)
- The daemon repo (`arclightd`) if you work on the panel↔daemon protocol

## First-time setup

```bash
pnpm install              # installs deps + generates Prisma client
cp example.env .env       # edit PORT, URL, SESSION_SECRET, DATABASE_URL
pnpm run dev              # dev server with auto-restart (also builds CSS)
```

`pnpm run dev` runs `prisma migrate deploy && prisma generate` first, then starts the panel with nodemon and Tailwind watch.

## Useful scripts

| Command | What it does |
|---------|--------------|
| `pnpm run dev` | Dev server (auto-restart + CSS watch) |
| `pnpm run typecheck` | `tsc --noEmit` for main, prisma, and tui configs |
| `pnpm test` / `pnpm run test:watch` | Vitest suite |
| `pnpm run lint` | ESLint over `src/` (autofix) |
| `pnpm run build` | `tsc` emit + prisma + Tailwind production CSS |
| `pnpm run setup` | Install + generate + `db push` + build (fresh installs) |
| `pnpm run secret` | Generate a `SESSION_SECRET` |

---

## Database migrations (Prisma)

The project uses **Prisma Migrate** with SQLite. Migrations live in `prisma/migrations/` as timestamped directories, each containing a `migration.sql` file.

### Normal workflow

```bash
# After changing prisma/schema.prisma, create a new migration:
npx prisma migrate dev --name describe_your_change

# In production (or when `pnpm run dev` starts), migrations are applied with:
npx prisma migrate deploy
```

`pnpm run dev` automatically runs `prisma migrate deploy && prisma generate` before starting the dev server, so you normally don't need to run these manually.

### Creating a migration

1. Edit `prisma/schema.prisma` with your model changes.
2. Run `npx prisma migrate dev --name my_change` — this generates the SQL, applies it to your local DB, and regenerates the client.
3. Commit the new `prisma/migrations/<timestamp>_my_change/` directory.

> **Tip:** Use `npx prisma migrate dev --create-only --name my_change` if you want to review/edit the SQL before applying it.

### Troubleshooting: failed migrations (P3009 / P3018)

If you see an error like this when running `pnpm run dev`:

```
Error: P3009

migrate found failed migrations in the target database, new migrations
will not be applied.

The `20260813000000_totp_recovery_codes` migration started at ... failed
```

This means a migration was attempted but failed partway through. Prisma refuses to apply any subsequent migrations until the failed one is resolved.

**Common cause:** The columns/tables already exist in your database (e.g. you previously ran `prisma migrate dev` or `prisma db push` which applied the schema changes directly), so the migration's `ALTER TABLE ... ADD COLUMN` fails with `duplicate column name`.

**How to fix it:**

1. **Check what the failed migration does:**
   ```bash
   cat prisma/migrations/<migration_name>/migration.sql
   ```

2. **Verify the changes already exist in your database.** You can inspect the schema with:
   ```bash
   node -e "
     const Database = require('better-sqlite3');
     const db = new Database('storage/dev.db');
     console.log(db.prepare('PRAGMA table_info(YourTable)').all());
     db.close();
   "
   ```

3. **If the changes are already applied**, mark the migration as resolved:
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```

4. **If the changes are NOT applied** (the migration genuinely failed), you can either:
   - Fix the underlying issue and roll back the failed record:
     ```bash
     npx prisma migrate resolve --rolled-back <migration_name>
     ```
   - Or reset the database entirely (⚠️ **destroys all data**):
     ```bash
     npx prisma migrate reset
     ```

5. **Run deploy again** to apply remaining pending migrations:
   ```bash
   npx prisma migrate deploy
   ```

> **Note:** Multiple migrations can fail in a cascade. If after resolving one you hit the same error on the next migration, repeat step 3 for each one.

### Nuclear option: full reset

If your local database is hopelessly out of sync with the migration history, you can wipe it and start fresh:

```bash
rm storage/dev.db
npx prisma migrate deploy   # re-creates the DB and applies all migrations
npx prisma generate          # regenerate the client
```

This is safe for **development only** — you will lose all local data.

---

## Testing

### Unit tests (Vitest)

```bash
pnpm test                     # run once
pnpm run test:watch           # watch mode
npx vitest run tests/backupsBackend.test.ts   # single file
```

Tests live in `tests/` and mirror `src/`. Many are **source-inspection tests** (they read `views/`/`src/` text and assert patterns — e.g. `cspHeaders.test.ts`, `responsiveA11y.test.ts`), so keep the exact strings they assert stable or update the tests alongside your change.

### Smoke tests (Playwright)

```bash
cd smoke && pnpm install && pnpm exec playwright install chromium
pnpm exec playwright test     # requires a running panel on the configured URL
```

The smoke suite drives a real browser through the "22-step journey" and asserts the panel renders `Arclight`.

### Daemon

The daemon is a separate repo with its own checks:

```bash
cd ../daemon
bun run typecheck && bun run lint && bun test
```

---

## The panel↔daemon contract

Both repos must agree byte-for-byte on:

- **Auth headers**: `X-Arclight-Timestamp`, `X-Arclight-Signature`, `X-Arclight-Nonce`, `X-Arclight-Payload-Version`, `X-Arclight-Digest` (panel signs in `src/handlers/utils/core/daemonRequest.ts`; daemon verifies in `security/hmac.ts`).
- **Auth scheme**: `Authorization: Basic Arclight:<node-key>`.
- **Payload version**: `1` (both sides).
- **Binary/service names**: `arclightd`, `arclight-daemon.service`, `.arclight/` runtime dir inside containers.

If you change any of these, update **both** repositories in the same PR.

---

## Adding a page (EJS flow)

1. Add a route in the relevant `src/modules/` module (`registerRoute` + permission checks).
2. Create the view under `views/` (reuse `views/components/` partials: `header`, `footer`, `template`, `toast`, `modal`).
3. Add any browser JS under `public/javascript/` and include it with `nonce`-aware `<script>` tags.
4. Register permission strings in `src/handlers/permissions.ts` if the page needs a new scope.
5. Add/extend tests (`tests/`) and a smoke assertion if the page is part of the core journey.

## Adding a language string

1. Add the key to `storage/lang/en/lang.json`.
2. Copy the value into the other 9 locale files (or leave a `|| 'English'` fallback).
3. Read it in templates via `req.translations.<key>`.

## Environment variables

See `example.env` for the full set. Notable: `NAME` (display name), `URL`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, and the daemon-facing `ARCLIGHT_*` vars used by the TUI/headless runner.

---

## Code standards

- **TypeScript strict** — the `strict` flag plus `noUncheckedIndexedAccess` is on; `tsc` is the gate.
- **ESLint** — see `eslint.config.mjs`. Rules like single quotes, semicolons, braces, and interface-over-type are enforced. `pnpm run lint` auto-fixes.
- **Prettier** — if you run `prettier`, configure it to match ESLint (`singleQuote: true`); prettier defaults (double quotes) conflict with the lint rules.
- **Security** — new outbound requests must pass the SSRF guard; user content goes through the CSP nonce model; never log secrets (see `docs/SECURITY.md`).
