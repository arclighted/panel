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
- Building `web` with `NODE_ENV=development` produces an SSR bundle that
  fails at runtime (`dispatcher.getOwner is not a function`, React 19.2 dev
  jsx-runtime) — pre-existing scaffold artifact, unrelated to Phase 1;
  production builds (`NODE_ENV=production`) render pages correctly. `pnpm
  build:web` should run with NODE_ENV=production.
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

### Phase 3 — WebSockets to Nitro

1. `/ws/realtime` (presence bus) → `defineWebSocketHandler`.
2. `/online-check` → same.
3. 3× `/console/:id` (terminal proxy browser → panel → daemon) → the
   trickiest; port the `wsUsers`/daemon pipe logic 1:1, keep the token flow.
4. Remove `express-ws`.

**Gate:** console connect + streaming works in browser; realtime presence
updates; `playwright` terminal smoke passes.

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