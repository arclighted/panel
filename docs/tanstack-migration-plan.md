# Migration Plan: Eliminate Express — Full TanStack Start Backend

**Branch:** `feat/tanstack-start-migration`
**Status:** Draft for review — no implementation until approved
**Version:** 2.5.193 (current root `package.json`)

This is the continuation of `MIGRATION_PLAN.md` (frontend cutover, done). That
plan kept Express as the backend authority. This plan **removes Express
entirely** and moves every backend responsibility into the TanStack Start
(Nitro) server.

---

## 1. Current state (audit — verified Aug 2026)

### 1.1 UI: 100% migrated, backend: 0%

| Surface | Owner today | Migrated? |
|---|---|---|
| HTML pages (56 routes: auth, dashboard, account, admin, server tabs) | TanStack Start | **100%** |
| All data APIs (~325 routes: 143 GET, 130 POST, 33 DELETE, 12 PATCH, 2 PUT) | Express | **0%** |
| All mutations (CSRF + session authority) | Express | **0%** |
| WebSockets (5: `/ws/realtime`, `/online-check`, 3× `/console/:id`) | Express (`express-ws`) | **0%** |
| Static: `public/`, `uploads/`, `addon-assets/:slug`, node_modules vendor (monaco, xterm, marked, chart.js), avatars | Express | **0%** |
| Auth: `express-session` + PrismaSessionStore, CSRF tokens, TOTP 2FA, rate limits, IP bans | Express | **0%** |
| Addon v3 UI runtime | TanStack (`web/src/lib/addon-v3/`) | **100%** |
| Addon v2 EJS views (`storage/addons/*/views/`) | Express renderResolver — **retired** (commits `a0f91029`, `39fd3f60`) | n/a (dead) |
| Multer uploads (avatar, create-server images, `admin/images/export`) | Express | **0%** |

### 1.2 The TanStack app is a client-side SPA shell

`grep createServerFn|createMiddleware` in `web/src/` → **0 hits**. No server
functions, no server middleware. All data flows:

```
browser → (Nitro serves HTML shell) → React Query/fetch → Node proxy → Express :3001
```

Two-process topology in prod (`web/server/index.mjs`): custom Node proxy on
`:3000` → Nitro child on `:3002` → Express on `:3001`. Dev (`web/vite.config.ts`
+ `proxyToExpress()` plugin) has the same seam: every non-GET and every
proxy-path GET is forwarded to Express.

This works, but the middle hop is legacy baggage, not a feature.

### 1.3 Addons: v2 views dead but not deleted

Both addons still ship `views/` dirs (arclight-cloud: `desktop`, `mobile`;
modrinth: `admin.ejs`, `browse.ejs`, `desktop`, `mobile`). The renderResolver
that consumed them is retired and `views/` (root) is deleted. The old
`addonHandler.renderView` API (v2) is unused by v3 addons. Safe to delete.

---

## 2. Migration strategy

Order is dependency-driven: session/CSRF first (everything else depends on
them), then APIs (largest chunk), then WebSockets, then static/uploads, then
delete Express. Each phase ends with a green verification gate and a working
app.

**Architecture decisions (all pre-agreed):**

- **D1 — One process, one port.** After Phase 5, a single Nitro server on
  `PORT` (3000) serves HTML, APIs, WS, static, uploads. No internal ports, no
  proxy code, no child spawn.
- **D2 — Auth must be seamless.** Session cookie layout and `CSRF-Token`
  header contract are preserved 1:1 (`/api/auth-config` + meta tag → same
  field names) so the React Query layer needs zero changes. Drift only in
  storage mechanism (PrismaSessionStore → Nitro-native or kept via h3
  middleware wrapping the same Prisma store).
- **D3 — API response shapes are a contract.** `/api/v1/*` and `/api/client/*`
  are consumed by external API-key clients; all `/api/*` shapes are consumed
  by React Query. Re-implement 1:1, never redesign.
- **D4 — WebSockets stay token-authenticated.** `/console/:id?token=` and
  `/ws/realtime` keep their auth handshake. Nitro 3 supports
  `defineWebSocketHandler` (verified present in `web/node_modules/nitro`).
- **D5 — Addon v2 views deleted, not ported.** The v3 UI contract is the only
  addon UI contract going forward.

---

## 3. Phases

### Phase 1 — Session + CSRF authority moves to Nitro

**Goal:** Nitro owns `req.session` + CSRF; Express (still serving APIs) reads
them from a shared source. Seam is intact, no UI change.

Steps:
1. Add Nitro middleware (`web/src/server/` or `web/src/middleware` for
   TanStack Start server funcs) that reproduces `express-session`
   + PrismaSessionStore behavior. Reuse the existing session logic module if
   it's already Prisma-backed and framework-free (`src/handlers/...session*`).
2. Expose the same `CSRF-Token` contract (`/api/auth-config`) from Nitro.
3. Keep Express session config as a fallback reader (same cookie secret,
   same cookie name) so both processes validate the same session during
   transition.

**Gate:** login → dashboard round trip works through the Nitro seam; existing
sessions survive a rolling restart; CSRF challenge still enforced on POSTs.

### Phase 1 — delivered (Aug 2026)

Nitro now owns `/api/auth-config` (session user + CSRF token) with a
byte-identical response shape; Express keeps the session middleware and CSRF
enforcement untouched. The two processes share one SQLite store and one
secret, so no Express code changed at all.

**Session contract (shared store, zero drift)**

- Cookie `connect.sid` = `s:<sid>.<signature>` (cookie-signature over the
  session id with `SESSION_SECRET`) — same layout `express-session` emits.
- Payload JSON lives in the `Session` table (`session_id` unique, `expires`
  TTL) exactly like `PrismaSessionStore` (`src/handlers/sessionStore.ts`).
- `web/server/utils/auth-session.ts` implements `loadSession` / `saveSession` /
  `destroySession` against the same Prisma store (own better-sqlite3 adapter,
  WAL + busy timeout, project-root `DATABASE_URL` resolution) and issues the
  same cookie. Anonymous first touches (CSRF issuance) persist a row exactly
  like Express's `addCsrfTokenToLocals`, so a token minted here validates on
  the next Express POST.

**CSRF contract (deterministic, cross-process)**

- csrf-csrf's `doubleCsrf` is stateless: token =
  `<hmac-sha256(SESSION_SECRET, [id.length, id, rnd.length, rnd].join('!'))>.<rnd>`
  with `id` = `session.csrfSessionId`, validated by double-submit. Both
  processes derive the same HMAC from the same DB row + secret → a token
  issued by Nitro validates in Express with zero Express changes.
- Cookie names/options mirror `csrfProtection.ts` exactly
  (`psifi.x-csrf-token` dev / `__Host-psifi.x-csrf-token` prod,
  sameSite strict, httpOnly, secure in prod).

**Files**

- `web/server/utils/auth-session.ts` — session + CSRF twin (rewritten; the
  previous scaffold stub used cookie-signed payloads + wrong cookie names).
- `web/server/utils/auth-config.ts` — pure `buildAuthConfigPayload()`
  producing the byte-identical `{ csrfToken, user, firstUser, settings }`
  shape (mirrors `src/modules/core/index.ts`).
- `web/server/routes/api/auth-config.get.ts` — the real handler (the previous
  stub returned a fake `userId`/`version` shape that would have broken the
  React Query layer).
- `web/server/middleware/01.session.ts` — attaches `event.context.session`
  (DB hit only when a session cookie is present).
- `web/server/env-loader.mjs` — loads repo-root `.env` for the web boot
  scripts; wired into `web/server/index.mjs` (prod) and `scripts/dev.mjs`
  (dev). `dev.mjs` also injects a single shared dev `SESSION_SECRET` when the
  env secret is missing/insecure so Express + Vite agree.
- `web/vite.config.ts` — `nitro({ serverDir: true, … })`: **Nitro 3 defaults
  `serverDir` to `false`, so `server/routes` + `server/middleware` were never
  compiled before this flag.** `proxyToExpress()` now skips Nitro-owned GETs.
- `web/proxy.config.ts` — Vite's `server.proxy` `/api` entry becomes a regex
  that excludes Nitro-owned paths (Vite treats `^`-prefixed keys as regexes;
  plugin `configureServer` middleware runs before the internal proxy).
- Prod seam (`web/server/index.mjs`) already routed `/api/auth-config` to
  Nitro — unchanged.
- Tests: `web/src/__tests__/nitro-session.test.ts` (real temp SQLite;
  round-trip, expired-row drop, cookie format, CSRF double-submit) +
  `web/src/__tests__/nitro-auth-config.test.ts` (shape pins via h3 app).

**Gates verified**

- `pnpm typecheck:web` ✓ (99/99 web tests ✓)
- `pnpm build:web` → `.output/server/_routes/api/auth_config.mjs` present ✓
- Prod boot: `curl :3100/api/auth-config` → byte-identical shape + both
  cookies (`connect.sid`, csrf) ✓; `GET /` SSR renders (NODE_ENV=production)
- Cross-process CSRF: token minted by Nitro → `POST /login` through the proxy
  to Express → **302 (accepted)**; the same POST without the token → **403**
  (challenge still enforced) ✓
- Dev: `/api/auth-config` served by Nitro (no Express security headers),
  `/api/account/context` still proxied to Express ✓

**Known deviations / notes**

- The Express `/api/auth-config` handler stays live on `:3001` (dead via the
  seam once Nitro owns the path) — removed in a later phase.
- `SESSION_SECRET` must be strong and shared in prod (`example.env` ships
  `change_me`, which both processes treat as insecure and each would replace
  with its own ephemeral in non-dev flows — `pnpm dev` handles this; prod
  requires an operator-set secret as documented in `docs/DEVELOPMENT.md`).
- **NODE_ENV is now forced production for builds and the prod launcher**
  (fix shipped with Phase 2 groups 4–6): `web/package.json` `build` =
  `NODE_ENV=production vite build` (so the SSR bundle can never bake in the
  dev JSX transform again) and `web/server/index.mjs` sets
  `process.env.NODE_ENV = 'production'` after `loadEnvFile()` (the repo `.env`
  ships `NODE_ENV="development"`, which used to leak into the Nitro child and
  crash every page render with `dispatcher.getOwner is not a function`
  (dev react-jsx-runtime vs prod react-server) or `jsxDEV is not a function`
  (dev-transform bundle vs prod react-jsx-dev-runtime, which sets
  `jsxDEV = void 0`). Prod smoke with Express down: all migrated pages render
  200 and every ported API answers from Nitro.
- The `01.session` middleware runs for every Nitro-served request (incl. SSR
  page renders) — same DB cost as Express's session middleware.

### Phase 2 — Migrate API routes to server functions / Nitro handlers

**Goal:** kill the 325 Express routes. Migrate in dependency order so the app
never loses a page.

Order (each is a sub-checkpoint with its own gate):

1. **Auth + account** (`authService`, `passwordReset`, `twoFactor`,
   `user/account`) — powers login/logout/register/2FA/profile.
2. **Read/context endpoints** (`/api/auth-config`, `/api/account/context`,
   `/api/admin/context`, `/api/admin/page/:page`, `/api/create-server/context`,
   `/api/folders`, `/api/server/:id/context`, `/api/system/status`) — the
   React Query bootstrap calls; everything renders from these.
3. **User server APIs** (`user/server/*`: power, status, files, console
   control, schedules, databases, backups, worlds, players, settings,
   subusers, feature/eula, ws-token) — the largest surface.
4. **Admin CRUD** (`admin/*` ~19 modules) — context-first, then per-entity
   (nodes, servers, users, images, mounts, databases, apiKeys, settings, …).
5. **External APIs** (`api/v1`, `api/client`) — last, lowest traffic;
   keep bearer-key `apiValidator` flow exactly.
6. **Create-server + uploads** (`user/createServer`, multer avatar/import/
   export) — h3 uploads replace multer.

Mechanics per route:
- Migrate as TanStack `createServerFn` where the UI is the only consumer.
- Migrate as Nitro route handlers (`/api/**`) for external/API-key surfaces.
- Copy handler logic, keep response JSON byte-identical.

**Gate per sub-checkpoint:** targeted smoke test (each migrated endpoint
returns the pre-migration shape for identical input), `tsc`, `pnpm
typecheck:web`, React Query pages for that area still work end-to-end.

### Phase 2 — delivered (auth + account group 1, Aug 2026)

Nitro now owns the four auth mutations (POST /login, POST /register, POST
/2fa) and GET /logout — the first real routes moved off Express. The React
layer needs zero changes: every redirect location, status code, error JSON
shape and the session/CSRF contracts are byte-identical to Express (D3).

**Routes** (`web/server/routes/`)

- `login.post.ts` — CSRF (403) → rate limit (429) → zod schema → bcrypt
  compare (dummy hash to defeat timing enumeration) → lockout counter/redirect
  → `regenerateSession` → 2FA pending (`/2fa`) or full session.user + login
  history → `302 /`. Mirrors `src/modules/auth/authService.ts` exactly.
- `register.post.ts` — CSRF → rate limit → zod error codes → first-user
  (owner/admin) / `allowRegistration` gate → duplicate check → bcrypt(12)
  create → `302 /login`.
- `logout.get.ts` — destroy session + clear `connect.sid` → `302 /login`.
- `2fa.post.ts` — CSRF → pending `pendingUserId` → TOTP (window 1) / recovery
  code (sha256, consumed) → `regenerateSession` + user + login history →
  `{ success: true, redirect: '/' }` with the same 400/500 JSON errors.

**Utils** (`web/server/utils/`)

- `auth.ts` — `getClientIp` (x-forwarded-for), `getSecuritySettings`
  (loginMaxAttempts/lockoutMinutes, `select`-projected), `recordLoginHistory`,
  `loginSessionUser` / `twoFactorSessionUser` (the two distinct session.user
  shapes Express writes).
- `rate-limit.ts` — per-IP in-memory limiter mirroring `authRateLimit`
  (10/min, shared by login + register), 429 `{error}` shape.
- `two-factor.ts` — faithful copy of the TOTP / recovery helpers.
- `auth-session.ts` — added `regenerateSession()` (destroy old row, fresh sid,
  empty payload, re-issue cookie) and `requireCsrf()` (header then `_csrf`
  body). **Important fix:** h3's `getCookie` only reads request-time headers,
  so a cookie just set by `regenerateSession` was invisible to a follow-up
  `saveSession` — that resurrected the *old* session id (a session-fixation
  bug). `saveSession` now prefers the sid tracked on `event.context`.

**Routing (seam)**

- Prod `web/server/index.mjs`: nitro-owned prefixes checked **before** the
  non-GET-to-Express rule, for all methods (query string stripped).
- Dev `web/vite.config.ts` `proxyToExpress`: nitro-owned paths bypass the
  Express proxy for all methods (was GET-only).
- `web/proxy.config.ts`: `NITRO_OWNED_PATHS` = auth-config + login/register/
  2fa/logout; `/logout` removed from `LEGACY_PAGE_PREFIXES`.

**Deps:** `bcryptjs 3.0.3`, `otpauth 9.5.1`, `zod 4.4.3` added to
`web/package.json` (pinned). Schemas are imported from root
`src/modules/auth/schemas.ts` (zero drift).

**Gates verified**

- `pnpm typecheck:web` ✓ · **115/115 web tests** ✓ (16 new auth-route tests:
  login/register/logout/2fa, CSRF 403, rate-limit 429, lockout, recovery code,
  session-regeneration regression guard)
- `NODE_ENV=production pnpm build` ✓ — `_routes/login|register|logout|2fa.mjs`
  compiled.
- **Prod smoke with Express NOT running** (definitive Nitro-ownership proof):
  register (302 /login, owner created) → login (302 /, session regenerated)
  → auth-config shows user → logout (302 /login) → no-CSRF POST (403) →
  rate-limit 11th attempt (429) → non-nitro `/api/account/context` (502,
  seam still routes to Express).
- Dev: auth-config/logout/`POST /login` served by Nitro (no Express
  headers); `/api/account/context` still proxied to Express.

**Notes**

- The Express auth routes stay live on `:3001` (dead via the seam) — removed
  in Phase 5.
- Rate limiting is per-process (Nitro only) — equivalent to the old Express
  limiter now that these routes never reach Express.
- The 2FA test expectation was corrected to match Express semantics: a 2FA
  login records login history once, at verification (the pending-user branch
  returns before `loginHistory.create`).

### Phase 2 — delivered (read/context group 2, Aug 2026)

Nitro now owns the seven GET read/context endpoints the React Query layer
bootstraps from: `/api/account/context`, `/api/folders`,
`/api/create-server/context`, `/api/system/status`, `/api/admin/context`,
`/api/admin/page/:page` and `/api/server/:id/context`. Payloads are
byte-identical to the Express handlers (D3) — the frontend data layers
(`web/src/lib/{account,folders,create-server,admin,server}.ts`) needed zero
changes.

**Routes** (`web/server/routes/api/`)

- `account/context.get.ts` — user + login history + nodes + images + `allowed`
  (image submission, admin override) + `settings.allowUserCreateImages`.
- `folders.get.ts` — user folders with their server members.
- `create-server/context.get.ts` — the gate ladder (`disabled` → `notAllowed`
  → `limitReached`) plus per-user limits, nodes, approved images, node
  headroom (sum-aggregate per node) and the least-loaded / preferred-node
  recommendation.
- `system/status.get.ts` — os/cpu/memory/uptime + per-node status via
  `checkNodeStatus` + server/user/node counts (admin only).
- `admin/context.get.ts` — admin identity + sidebar groups from the shared UI
  store + `require2faForAdmins`.
- `admin/page/[page].get.ts` — the full `loadPageData` switch (~24 cases:
  overview, users, nodes, servers, images, api-keys, mounts, databases,
  settings, menu, …) with per-case shapes (e.g. `users-view` sets
  `canTransferOwner` for the owner viewing a non-owner).
- `server/[id]/context.get.ts` — `requireServerAccess` (admin / owner /
  subuser, suspended 403), image features after EULA resolution, install
  state, initial daemon status (`getServerStatus`), the server nav filtered
  by admin/owner/feature/subuser-permission, and the resolved `:uuid` URLs.

**Utils** (`web/server/utils/`)

- `auth.ts` — extended with the guards: `requireAuthenticated` (302 /login),
  `requireAdmin` (302 /login → 403 non-admin → 302 2fa-setup when required),
  `requireServerAccess` (admin / owner / subuser, suspended 403, 302 /
  fallback) and `safeUser` / `subUserHasPermission` (faithful ports of
  `src/handlers/utils/auth/authUtil.ts` + `serverAuthUtil.ts`).
- `admin-pages.ts` — port of `loadPageData` (addon-driven cases + the DB
  queries); `paths.ts` — small path resolution helper.
- `ui-store.ts` — wraps the **real** Express `uiComponentHandler` (lucide
  icons) and runs `initializeDefaultUIComponents()`, so the admin sidebar
  groups and server nav match Express exactly.

**Seam (method-aware)**

- `web/proxy.config.ts` / `web/server/index.mjs` / `web/vite.config.ts`: the
  seven prefixes are Nitro-owned **for GET only**; sibling mutations under the
  same prefixes (`POST /api/folders`, `/api/admin/*` CRUD, …) stay
  Express-owned. `/api/server/:id/context` is matched structurally so the
  sibling `/api/server/:id/*` tab APIs remain Express-owned.

**Root-src lint cleanup (behavior-neutral):** importing root modules into the
Nitro bundle pulled them under web's stricter tsconfig (`noUnusedLocals` +
DOM lib). `src/handlers/logger.ts`, `uiComponentHandler.ts`,
`utils/core/daemonRequest.ts` and `src/utils/http.ts` got trivial unused-var /
`BodyInit` fixes; `web/tsconfig.json` gained `customConditions: ["node"]` so
consola resolves its Node types instead of the browser build.

**Gates verified**

- `tsc` root + web ✓ · **137/137 web tests** ✓ (22 new
  `nitro-context-routes.test.ts`: full payload shapes, gate ladder,
  admin-page cases, nav filtering, subuser permissions, 403s and redirects)
- `NODE_ENV=production pnpm build` ✓ — all 7 routes compiled (dynamic
  `[page]` emitted as a manifest route).
- **Prod smoke with Express NOT running** (definitive Nitro-ownership proof):
  register → login → auth-config shows user → all 7 context endpoints 200
  with correct shapes (system/status stats, admin sidebar groups, server
  context 404 for an unknown UUID, non-admin 403) → non-nitro
  `/api/account/settings` still 502s to Express.

**Known deviations / notes**

- The server nav (`server/[id]/context`) comes from the Nitro-side default UI
  store (`initializeDefaultUIComponents`). Addon **v2 runtime** sidebar items
  (`ui.addSidebarItem` from `storage/addons/*/dist`) still live in the Express
  process and are invisible to Nitro — they show on `/api/admin/context` via
  Express only today. No addon ships `serverMenu` items, so the server nav is
  already byte-identical. The addon runtime moves into Nitro in a later phase.
- The Express versions of all seven endpoints stay live on `:3001` (dead via
  the seam) — removed in Phase 5.

### Phase 2 — delivered (user server tab reads group 3a, Aug 2026)

Nitro now owns the seven **server tab read** endpoints the React tab pages
load: `GET /api/server/:id/{settings,startup,databases,schedules,backups,
subusers,worlds}`. Payloads are byte-identical to the Express handlers in
`src/modules/user/server/tabs.ts` + `worlds.ts` (D3) — the frontend data
layers (`web/src/lib/server-tabs.ts`, `server-pages.ts`) needed zero changes.

**Routes** (`web/server/routes/api/server/[id]/`)

- `settings.get.ts` — server identity + limits, node/image names,
  `allowUserDeleteServer` from settings, auth meta.
- `startup.get.ts` — start command + edit flag, current Docker image,
  available Docker images, parsed startup variables, auth meta.
- `databases.get.ts` — databases with host info, hosts for the node,
  user DB limit/count (owner maxDatabases → settings default), auth meta.
- `schedules.get.ts` — schedules with tasks (payloads JSON-parsed), auth meta.
- `backups.get.ts` — backup rows with `size` as a string, auth meta.
- `subusers.get.ts` — **owner-only** (403 non-owners, mirroring the Express
  owner check), subusers with parsed permissions + user identity,
  `PERMISSION_LABELS` / `PERMISSION_GROUPS` for the React permission UI.
- `worlds.get.ts` — daemon fs-list filtered by `isWorld`, features, install
  state, daemon status, `daemonError` on a failed fs-list.

**Utils** (`web/server/utils/`)

- `server-tabs.ts` — `loadTabContext` (requireServerAccess → subuser
  permission gate → server row with the page include), `authMeta`,
  `requireTabPermission` (403 for subusers without the permission; owners/
  admins always pass) and mirrored `PERMISSION_LABELS` / `PERMISSION_GROUPS`
  (importing the Express source would drag nodemailer / Express-flavored
  request types into the Nitro bundle — static UI contract data mirrored like
  `getImageFeatures` in group 2).

**Seam (method-aware, structural)**

- `web/proxy.config.ts` / `web/server/index.mjs`: the `/api/server/:id/*`
  read regex now covers `context` + the seven tab reads for GET only
  (`NITRO_OWNED_SERVER_GET_RE`); sibling tab mutations (`/server/:id/*`,
  no `/api` prefix) stay Express-owned and are untouched by the GET regex.

**Gates verified**

- `tsc` root + web ✓ · **19 new tests** (`nitro-server-tabs.test.ts`: payload
  shapes, auth meta, subuser permission 403s, owner-only subusers, admin 404
  vs non-admin `/` redirect for missing servers, daemon-offline worlds) ✓
  (the 2fa/dashboard flakes are the pre-existing parallel-load timing issue
  documented in group 2 — untouched, pass in isolation)
- `NODE_ENV=production pnpm build` ✓ — all 7 routes compiled.
- **Prod smoke with Express NOT running** (`web/arclight-smoke-group3a.mjs`,
  boots the real prod proxy + Nitro child only): register → login →
  auth-config shows user → all 7 tab reads 200 with correct shapes →
  group-2 context regression 200 → `POST /server/:id/settings` mutation and
  un-migrated `GET /api/server/:id/files` still **502** to Express
  (definitive Nitro-ownership proof).

**Notes**

- `subusers` is owner-only: the Express tab handler checks `ownerId !==
  user.id` *after* `isAuthenticatedForServer`, so admins who don't own the
  server also get 403 — the Nitro port preserves this exactly.
- The Express versions of the seven endpoints stay live on `:3001` (dead via
  the seam) — removed in Phase 5.
- Group 3 continued with 3b (power/status/logs/ws-token + players + eula),
  3c (files) and 3d (CRUD mutations: settings, startup, schedules,
  databases, backups, subusers) — delivered above; the seam now claims the
  whole `/server/:id/*` namespace.

### Phase 2 — delivered (server API mutations group 3b/3c/3d, Aug 2026)

Nitro now owns the **entire** `/server/:id/*` API namespace — the console/
power/status/logs/ws-token/players/eula GETs and the settings/startup/
schedules/databases/backups/subusers/files/upload mutations. These were the
last routes still 502ing to Express from the panel pages; every one now
answers from Nitro with byte-identical shapes (D3) — the React layers
(`web/src/lib/files.ts`, `server-tabs.ts`, `server-pages.ts`) needed zero
changes.

**Routes** (`web/server/routes/server/[id]/`)

- Console/power: `console/send.post`, `console/queued.get`,
  `power/{start,stop,restart,kill}.post` (+ `queue/cancel.post`,
  `power/[poweraction].post`), `power/restart` is deliberately NOT ported as
  a separate route — Express registers `power/:poweraction` first so
  `/power/restart` is shadowed (dead) there; h3 static-beats-dynamic would
  diverge, so one param route covers it.
- Status/logs/ws-token/players/eula: `status.get`, `logs/history.get`,
  `logs/archives/{list,read}.get`, `ws-token.get`, `players/data.get`,
  `feature/eula.post`, `upload.post` (multipart via h3 `readMultipartFormData`
  + daemon upload, header-CSRF like the Express global middleware).
- Files 3c: `files/list.get`, `files/read.get`, `files/write.post`,
  `files/mkdir.post`, `files/copy.post`, `files/rename.post`,
  `files/delete.post`, `files/pull.post`, `files/zip.post`,
  `files/unzip.post` (all daemon-backed; `daemonError`/502 branches mirror
  Express exactly).
- CRUD 3d: `settings.post`, `rename.post`, `reinstall.post`, `startup/{start
  command, docker-image, variables}.post`, `schedules.post` +
  `[scheduleId].{patch,delete,run}.post` + `[scheduleId]/tasks.{post,
  delete}`, `databases.post` + `[dbId].{delete,rotate-password}.post`,
  `subusers.post` + `[subUserId].{put,delete}`, `backups/create.post`,
  `backups/progress.get`, `backups/restore/progress.get`,
  `backups/[backupId].{restore.post, delete, lock.patch, download.get}`.

**Utils** (`web/server/utils/`)

- `server-api.ts` — `loadMutationServer` (owner/subuser permission gate +
  admin 403 mirror), `loadApiServer`, `logActivity` (audit twin with the same
  sliding-window rate limit), `getServerStatusInput` / `getPrimaryPort` /
  `getImageFeatures` mirrors, `acceptsJson`, and the interop-safe
  `resolveCronParser` (see note below).
- `server-tabs.ts` — exported the `SUBUSER_PERMISSIONS` UI contract used by
  the subusers routes.

**Seam — `/server/:id/*` claimed wholesale**

- A route-coverage script proved 100% of the Express `/server/:id/*` API
  surface has a Nitro twin (the only untwinable entries are the TanStack-
  owned page renders and the dead `power/restart`). No addon v3 route
  registers under `/server/:id/*`. `web/proxy.config.ts` +
  `web/server/index.mjs` now treat every `/server/:id/*` (and `/server/*`)
  path as Nitro-owned for all methods.

**Gates verified**

- `tsc` root + web ✓ · **112/112 Nitro tests** ✓ (`nitro-server-api.test.ts`,
  41 new tests: shapes, guard 403s, self-subuser 400, CSRF 403, daemon-
  offline optimistic power/settings, backup lock, schedule CRUD)
- `NODE_ENV=production pnpm build` ✓ — all routes compiled.
- **Prod smoke with Express NOT running** (`web/arclight-smoke-group3bcd.mjs`,
  17/17): register → login → status/ws-token/players 200 → power/stop,
  settings, schedules, subusers, backups/lock all answer from Nitro (were
  502!) → no-CSRF POST 403 → un-migrated `/api/server/:id/files` still 502s
  (seam intact).

**Known deviations / notes**

- **cron-parser interop:** Nitro's prod bundle `__toESM` sets `default` to
  the whole CJS exports object, so `cronParser.parse` is not top-level and
  the default is the `CronExpressionParser` class (not callable without
  `new`). `resolveCronParser` normalizes namespace `.parse`, `.default.parse`
  (static), callable-default and callable-module shapes so schedules work
  identically in vitest and prod. (First fix checked `.parse` then fell back
  to the object itself — 400 in prod only; caught by the smoke.)
- The Express versions of all these routes stay live on `:3001` (dead via
  the seam) — removed in Phase 5.
- `upload.post` reads multipart bodies (no JSON `readBody`) and keeps
  header-CSRF validation — mirrors Express's global `doubleCsrfProtection`
  covering uploads (the frontend `uploadFile` always sends the `CSRF-Token`
  header; a multipart `_csrf` field is unreachable today).
- **Realtime note (in-process bus):** `emitRealtime`/`serverEvent`
  (`src/handlers/realtime/events`) push to the Nitro process's own in-memory
  hub, but WebSockets (`/ws/realtime`) are still served by Express until
  Phase 3. Real-time updates emitted by migrated mutations therefore don't
  reach connected clients yet — masked by React Query refetch-on-mutation.
  Resolved when WS moves to Nitro in Phase 3.

### Phase 2 — delivered (admin CRUD group 4, external APIs group 5,
create-server + uploads group 6, Aug 2026)

Nitro now owns the remaining Express API surface: the full **admin**
mutation/read set, the **external** `api/v1` + `api/client` Bearer-key APIs,
and the **create-server / my-images / avatar upload** surfaces. Together with
groups 1–3 this completes Phase 2 — every `/api/*`, `/server/*`,
`/create-server`, `/my-images` and avatar route now answers from Nitro with a
byte-identical shape (D3); the React layers (`web/src/lib/admin.ts`,
`server-pages.ts`, `my-images.ts`, etc.) needed zero behavioral changes (only
the trailing-slash normalization below).

**Routes** (`web/server/routes/`)

- Group 4 admin (ALL methods, `admin/` + `api/admin/`): users (create/update/
  delete/transfer-owner), nodes (create/edit/maintenance/verify/delete),
  servers (create/edit/suspend/unsuspend/transfer/delete), apikeys
  (create/edit/toggle/delete), databases (create/test/delete), mounts
  (create/delete), locations (create/delete), settings (general/security/
  s3/smtp/server-policy/ban-ip/unban-ip/reset + the combined `settings.post`
  incl. multipart wallpaper upload), radar (scripts, virustotal,
  vt-scan, crypto/malware scan, plugin audit), images (create/edit/approve/
  reject/delete/list/upload/import-url/export + store catalogue/install/
  refresh), check-update, perform-update, playerstats, analytics.
- Group 5 external (`api/v1/`, `api/client/`): full images/locations/nodes/
  servers CRUD + nested allocations/backups/databases/schedules + client
  files (list/content/rename/delete) + power + ping + index — all under the
  **`apiValidator` twin** (Bearer/api-key, `x-api-key` header, host check,
  JSON:API-style error shapes 1:1 with `src/handlers/apiValidator.ts`).
- Group 6 user-facing: `create-server.post` (full egg/docker parse +
  allocation + daemon create flow), `my-images/*` (create via egg upload /
  import-url, delete, update state, `api/my-images/[id].get` edit payload),
  `upload-avatar.post` / `remove-avatar.post` (multipart via h3).

**Utils / shared fixes**

- `web/server/utils/api-validator.ts` — Bearer + `x-api-key` auth twin
  (sha256 key comparison, per-key host allowlist, same 401/403 error shapes).
- `web/server/utils/server-api.ts` — `ActivityEvent` union extended
  (`image:submit`, `mount:create`, …) and activity logging wired into the
  new admin mutations (same audit rows as Express).
- `src/handlers/utils/server/serverTransfer.ts` + `src/modules/admin/
  servers.ts` — dropped the now-unused `req` params from `startTransfer` /
  `runTransfer` (behavior-neutral; surfaced by web's `noUnusedLocals`).
- `src/handlers/utils/egg/eggParser.ts`, `logger.ts`, `uiComponentHandler.ts`,
  `utils/core/daemonRequest.ts`, `src/utils/http.ts` — pre-existing unused-
  import / `BodyInit` cleanups needed once root modules entered web's tsc
  scope (behavior-neutral, identical to group 2's root-src lint cleanup).
- `web/src/lib/admin.ts` — trailing slashes removed from `updateUser` /
  `deleteUser` / `transferOwner` URLs: Nitro's router (unjs/radix3) matches
  exact paths while Express tolerated both, so bare `:id` URLs work on both
  sides of the seam.
- `upload-avatar.post.ts` — **h3 multipart returns `Uint8Array`, not
  `Buffer`**: `inspectImage` (root `src/utils/imageSecurity.ts`) requires
  `Buffer.isBuffer`, so the avatar bytes are wrapped in `Buffer.from(part.data)`
  before inspection/write (caught by the group-6 test; the server file-upload
  route already converted).

**Seam — remaining Express surfaces**

- `web/proxy.config.ts` / `web/server/index.mjs` `NITRO_OWNED_PATHS` grew
  the group 4/5/6 prefixes (ALL methods): the admin mutation surfaces,
  `/api/v1`, `/api/client`, `/create-server`, `/my-images`, `/api/my-images`,
  `/upload-avatar`, `/remove-avatar`. The group-2 GET-only prefixes and the
  group-3 whole-`/server/:id/*` claim are unchanged.
- Intentionally still Express-owned: `/admin/addons/*` (the addon v3 runtime
  toggle/uninstall/reload needs the Express app instance) and the addon v3
  apiPaths (`/arclight-cloud/api`, `/modrinth/api`).

**Prod-launcher hardening (found during the group-6 smoke)**

- `web/server/index.mjs` now forces `NODE_ENV=production` (see Phase 1
  notes) and its `SIGTERM`/`SIGINT` handlers call `process.exit(0)` after
  killing the child — previously the launcher outlived its child and kept the
  port bound, so a restart hit `EADDRINUSE`.

**Gates verified**

- `tsc` root + web ✓ · **17 new tests** (`nitro-phase2-groups456.test.ts`:
  admin mounts/locations/settings CRUD + activity audit, api/v1 users/images
  CRUD + Bearer auth, api/client schedules, my-images create/delete/update,
  avatar upload valid-PNG / bad-image 400, wallpaper settings multipart) ✓
  — full web suite 219/219 ✓ when run serially (the 2fa/dashboard flakes
  remain the pre-existing parallel-load timing issue, untouched).
- `NODE_ENV=production pnpm build` ✓ — all routes compiled.
- **Prod smoke with Express NOT running** (definitive Nitro-ownership proof):
  `/api/auth-config` issues session + CSRF cookies, migrated pages
  (`/`, `/login`, `/register`, `/my-images`, `/create-server`) render **200**
  through Nitro SSR, migrated APIs answer from Nitro (auth-config 200,
  v1/ping 200, admin/context 302→login, v1/users 401 no key), and the
  still-Express surfaces (`/api/addons/ui/list`, `/uploads/x.png`) **502**.

**Notes**

- The Express versions of all these routes stay live on `:3001` (dead via
  the seam) — removed in Phase 5.
- With groups 4–6 done, the only browser-reachable Express surfaces are the
  addon v3 apiPaths, `/admin/addons/*`, WebSockets (Phase 3) and static
  uploads/assets (Phase 4).

### Phase 3 — WebSockets to Nitro

1. `/ws/realtime` (presence bus) → `defineWebSocketHandler`.
2. `/online-check` → same.
3. 3× `/console/:id` (terminal proxy browser → panel → daemon) → the
   trickiest; port the `wsUsers`/daemon pipe logic 1:1, keep the token flow.
4. Remove `express-ws`.

**Gate:** console connect + streaming works in browser; realtime presence
updates; `playwright` terminal smoke passes.

### Phase 3 — delivered (all WebSockets to Nitro, Aug 2026)

Nitro (crossws via `defineWebSocketHandler`) now serves every panel
WebSocket. The prod launcher (`web/server/index.mjs`) forwards all WS
upgrades to the Nitro child instead of Express; the dev proxy no longer
proxies `/ws` or `/console` to Express (Vite's dev server handles the
upgrades through Nitro's `features.websocket` wiring).

**Routes (all crossws handlers, `peer.websocket` is the raw `ws` socket so
the Express logic ports 1:1):**

- `server/routes/ws/realtime.ts` — the realtime bus. Session-cookie auth via
  the `01.session` middleware (the full h3 chain runs before the WS hooks),
  heartbeat/pong, `sync` resynchronization, per-server `watch`/`watchEvents`
  with the session-can-see gate, `watchAll`, and per-session release. Reuses
  the root `realtime/hub`, `access`, `serverStatusWatcher` and
  `serverEventWatcher` modules unchanged.
- `server/routes/online-check.ts` — presence; sets now live in the Nitro
  process (nothing in the migrated surface consumes them).
- `server/routes/console/[id].ts`, `status/[id].ts`, `events/[id].ts` — the
  console proxy. `server/utils/console-proxy.ts` ports `proxyConsole`
  verbatim (binary-preserving frames, capability-token daemon auth, pending
  queue, command extraction → REST `/container/command`) and mirrors
  `isAuthenticatedForServerWS('id')` + the subuser `console` permission gate
  for the interactive route.

**Config / seams:** `nitro({ features: { websocket: true } })` in
`vite.config.ts` (required — it gates crossws upgrade wiring in both the
prod node server and the Vite dev server); `ws@^8.21.0` added to
`web/package.json`; `web/proxy.config.ts` drops `/ws` + `/console` from
`API_PROXY_PATHS` (and the now-unused `ws: true` proxy flag);
`web/server/index.mjs` routes upgrades for `/ws`, `/console`, `/status`,
`/events`, `/online-check` to the Nitro child (Express WS is retired).

**Split-brain resolved:** the realtime hub now lives in the Nitro process
alongside every React-app mutation and the daemon watchers, so React sockets
receive the full event stream (status/stats/lifecycle + mutation events).
The Phase 2 note above (“events don't reach connected clients yet”) no
longer applies to the React client. Events emitted by legacy Express-process
mutations remain invisible to the Nitro hub — the documented migration seam
(the EJS client never connects to this endpoint).

**Validation:** 11 new integration tests
(`web/src/__tests__/nitro-websocket.test.ts`) drive the real crossws hooks
through the composed app — realtime handshake/close codes, presence
bookkeeping, console token + permission + daemon-down paths; 230/230 web
tests pass serially. Prod smoke (`web/arclight-smoke-phase3.mjs`) boots the
launcher WITHOUT Express and connects real `ws` clients through the upgrade
seam: realtime.ready/synced, 4401 without a cookie, `{online:true}`, console
error JSON, and the daemon-unreachable message — all green.

**Remaining (Phase 5):** delete `express-ws` + the Express WS modules.

**Not yet verified:** the DEV seam end-to-end (prod smoke + unit tests cover
the handlers and the prod upgrade path; dev relies on the same
`features.websocket` wiring in `vite.dev.mjs` + the removed `/ws`/`/console`
proxy entries). A `pnpm dev` run connecting a `ws` client to
`ws://localhost:3000/ws/realtime` should show `realtime.ready` with a
session cookie before Phase 4.

### Phase 4 — Static, uploads, addon assets

1. `public/` (root) → Nitro `public/` or `NitroAssets` mount; verify
   `/uploads`, `/avatar`, `/favicon.ico`, `/styles.css`.
2. node_modules vendor paths (`/monaco`, `/xterm`, `/marked`, `/chart.js`,
   `/vendor/...`) → move into `web/public/vendor/` (build script already
   exists: `scripts/build-vendor.mjs`) and serve from Nitro.
3. `/addon-assets/:slug` → Nitro handler (or keep in Nitro public w/ symlink.
   mirror current Express logic).
4. Delete addon v2 `views/` dirs + retired render code (verify no v2 callers).

**Gate:** full page load → all assets 200, no Express hits in the network
panel; avatars and addon assets visible.

### Phase 5 — Delete Express

1. Remove `web/server/index.mjs` + `web/proxy.config.ts` + the
   `proxyToExpress()` vite plugin; dev proxy config deleted.
2. Delete `src/app.ts` Express app + `express`/`express-session`/`express-ws`/
   `multer`/`compression`/`cookie-parser` deps from root `package.json`.
3. Single `pnpm --filter arclight-web start` serves everything; root
   `start:panel`/`dev` scripts repointed.
4. Remove the now-dead 75 `res.render` sites noted in `39fd3f60` (they're
   unreachable today; after Express dies they're unreachable forever — delete
   with the modules).
5. Update `installer.sh` + systemd unit (`arclight-web.service`) if it points
   at the proxy.

**Gate:** `pnpm build && build:web`, boot from clean install, end-to-end
smoke (auth → dashboard → create server → console → admin → API-key call).

---

## 4. Verification gates (shared)

Applied at every phase, not just the end:

| Check | Command |
|---|---|
| Root typecheck | `pnpm build` (tsc) |
| Web typecheck | `pnpm typecheck:web` |
| Web tests | `pnpm test:web` |
| Vendor build integrity | `pnpm verify:vendor` |
| Prod boot smoke | `pnpm build:web && pnpm start:web` → curl pages/API/WS |
| E2E | playwright suite for auth + server tabs (extend per phase) |

**Regression rule:** no phase may make a previously-passing smoke test fail.
If a phase needs an intermediate Express crutch (D2 fallback session reader),
it must be removed no later than the next phase's gate.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Session/CSRF drift breaks React Query layer | D2: byte-identical contract; gate = full round trip |
| WS console proxy breaks silently | Port logic 1:1, token flow unchanged, playwright smoke |
| External API consumers break | `/api/v1` + `/api/client` migrate last, shapes frozen |
| Two-process → one-process migration race | Phases 1–4 keep Express alive; decommission only in 5 |
| Addon v3 UI calls Express apiPaths (`/arclight-cloud/api`, `/modrinth/api`) | apiPaths migrate with Phase 2 group 4/5; keep proxy entry until then |

---

## 6. Decision log

- **D1** Single process, single port. (approved)
- **D2** Auth contract preserved 1:1; storage may change. (approved)
- **D3** API shapes frozen; reimplement not redesign. (approved)
- **D4** WS keeps token auth; Nitro `defineWebSocketHandler`. (approved)
- **D5** Addon v2 views deleted. (approved)

---

## 7. Contradictions with old plan

`MIGRATION_PLAN.md` deliberately scoped Express OUT (§1). This plan is the
follow-through — it inverts that boundary in the same branch and same
architecture. Old plan's §1 "NOT in scope" list items (REST API, WebSocket
server, Express session, TUI) are exactly what this plan migrates, except the
TUI (`src/tui`, `pnpm run start`) which is a separate console client that
talks to the panel and is unaffected.