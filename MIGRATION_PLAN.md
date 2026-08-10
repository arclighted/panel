# Migration Plan: Arclight Panel Frontend → TanStack Start + React + shadcn/ui

**Branch:** `feat/tanstack-start-migration`
**Status:** Draft for review — **no implementation until this plan is approved** (hard checkpoint per task Step 2).
**Version:** 2.5.193 (current `package.json`)

This plan migrates the panel's presentation layer from server-rendered EJS + Turbo/Stimulus to a
TanStack Start + React + shadcn/ui frontend while keeping the existing Node.js/Prisma backend, REST
API, and WebSocket layer intact. It was produced after a structured interview (grilling session)
with the maintainer; the agreed decisions are recorded in §10 and are authoritative.

---

## 1. Scope boundary

**This migration targets the presentation/view layer only.**

The following are **NOT** in scope and must remain untouched unless a specific incompatibility is
found (in which case it is flagged in §9 and raised with the maintainer *before* changing it):

- Prisma schema (`prisma/schema.prisma`) and migrations
- The daemon HMAC protocol (headers, `Basic Arclight:` auth, payload version) — see `docs/DEVELOPMENT.md`
- The REST API (v1 + legacy `/api/*`, `/api/client/*`) — response shapes are a contract with
  external API-key consumers and the client API
- The WebSocket server (`src/handlers/realtime/*`, `src/modules/user/serverConsole.ts`) and its token flow
- Express session handling (`PrismaSessionStore`) and TOTP 2FA verification logic
- The TUI / headless runner (`src/tui/`, `pnpm run start`) — a separate console client, unaffected
- Addon **server-side** logic: Express routers, Prisma/config access, permissions, scheduler,
  lifecycle hooks, migrations (§4)

The migration **does** change, by design (all approved):

- Which process serves HTML (TanStack server instead of Express, §5.1)
- The addon **UI** public contract (v3, §4) — a breaking change, explicitly agreed
- The client-side framework (Turbo/Stimulus/`al-*` controllers → React)
- The design system (`al-*` classes + EJS partials → shadcn/ui primitives)
- Dev/build/deploy wiring (§7)

---

## 2. Page/route inventory (81 EJS views → TanStack routes)

Mapping key: `view` → `current URL pattern` → `planned TanStack route`. Phases per §5.3.
All URL paths are preserved 1:1 — the URL seam (§5.2) guarantees this.

### 2.1 Auth (`views/auth/`) — Phase 1

| View | URL | TanStack route | Notes |
|---|---|---|---|
| `login.ejs` | `/login` | `/login` | Reuses POST `/auth/login`; CSRF + session unchanged |
| `register.ejs` | `/register` | `/register` | Reuses POST `/auth/register` |
| `2fa-verify.ejs` | `/2fa` (verify step) | `/login/2fa` | TOTP verify endpoint unchanged |
| `forgot-password.ejs` | `/forgot-password` | `/forgot-password` | |
| `reset-password.ejs` | `/reset-password` | `/reset-password` | |

### 2.2 User panel (`views/user/`) — Phase 1–4

| View | URL | TanStack route | Phase |
|---|---|---|---|
| `dashboard.ejs` | `/` | `/` (index route) | 1 |
| `account.ejs` | `/account` | `/account` | 1 |
| `2fa-setup.ejs` | `/2fa` (setup) | `/account/2fa` | 1 |
| `credits.ejs` | `/account/credits` | `/account/credits` | 1 |
| `create-server.ejs` | `/create-server` | `/create-server` | 2 |
| `my-images.ejs`, `my-images-edit.ejs` | `/my-images`, `/my-images/edit/:id` | `/my-images` (+edit) | 2 |
| `server/manage.ejs` | `/user/server/:uuid` | `/$server/manage` | 3 |
| `server/settings.ejs` | `/user/server/:uuid/settings` | `/$server/settings` | 3 |
| `server/startup.ejs` | `/user/server/:uuid/startup` | `/$server/startup` | 3 |
| `server/subusers.ejs` | `/user/server/:uuid/subusers` | `/$server/subusers` | 3 |
| `server/schedules.ejs` | `/user/server/:uuid/schedules` | `/$server/schedules` | 3 |
| `server/backups.ejs` | `/user/server/:uuid/backups` | `/$server/backups` | 3 |
| `server/databases.ejs` | `/user/server/:uuid/databases` | `/$server/databases` | 3 |
| `server/players.ejs` | `/user/server/:uuid/players` | `/$server/players` | 3 |
| `server/worlds.ejs` | `/user/server/:uuid/worlds` | `/$server/worlds` | 3 |
| `server/files.ejs`, `server/files-rows.ejs`, `server/file.ejs` | `/user/server/:uuid/files`, `.../files/edit` | `/$server/files` (+editor route) | 4 — monaco editor |
| `server/logs.ejs` + `manage.ejs` console pane | `/user/server/:uuid` (console tab) | `/$server/console` | 4 — xterm |

> Route params: current URLs use `:uuid`; TanStack file routes can use `/$server` with a validated
> `uuid` param. The console and "manage" currently share `manage.ejs` — split into `console` +
> `overview` routes to match the tab structure.

### 2.3 Admin panel (`views/admin/`) — Phase 2

| View | URL | TanStack route | Phase |
|---|---|---|---|
| `overview/overview.ejs` | `/admin` | `/admin` | 2 |
| `nodes/*` (list/create/edit/stats) | `/admin/nodes...` | `/admin/nodes` (+create/edit/stats) | 2 |
| `servers/*` | `/admin/servers...` | `/admin/servers` (+create/edit) | 2 |
| `users/*` | `/admin/users...` | `/admin/users` (+create/edit/:id) | 2 |
| `images/*` (list/edit/store/approvals) | `/admin/images...` | `/admin/images` (+edit/store/approvals) | 2 |
| `apikeys/*` (list/docs) | `/admin/apikeys`, `/admin/apikeys/docs` | `/admin/api-keys` (+docs) | 2 |
| `addons/addons.ejs`, `addons/store.ejs` | `/admin/addons`, `/admin/addons/store` | `/admin/addons` (+store) | 2 |
| `settings/settings.ejs` | `/admin/settings` | `/admin/settings` | 2 |
| `databases/*` | `/admin/databases...` | `/admin/databases` (+create) | 2 |
| `mounts/index.ejs` | `/admin/mounts` | `/admin/mounts` | 2 |
| `menu/menu.ejs` | `/admin/menu` | `/admin/menu` | 2 |
| `activity/activity.ejs` | `/admin/activity` | `/admin/activity` | 2 |
| `analytics/analytics.ejs` | `/admin/analytics` | `/admin/analytics` | 2 — recharts |
| `playerstats/playerstats.ejs` | `/admin/playerstats` | `/admin/playerstats` | 2 — recharts |

### 2.4 API documentation

| View | URL | TanStack route |
|---|---|---|
| `api/documentation.ejs` | `/api/v1/docs` | `/docs/api` (React) — content ported from the EJS docs |

### 2.5 Shared layout components (`views/components/`) → shadcn mapping

These are not routes; they are replaced by shadcn primitives + a React shell. Mapping for parity:

| EJS component | shadcn/React replacement |
|---|---|
| `header.ejs`, `template.ejs`, `footer.ejs`, `bottomNav.ejs` | React shell: sidebar + topbar + mobile bottom nav |
| `toast.ejs`, `modal.ejs`, `loadingPopup.ejs`, `imageViewer.ejs` | Sonner toasts, AlertDialog/Dialog, loading skeleton, image dialog |
| `serverHeader.ejs`, `serverMeta.ejs`, `serverFeatures.ejs`, `serverTemplate.ejs` | Server header components under `/$server/_layout` |
| `portsAllocator.ejs`, `sftp.ejs` | Dedicated React components (ports form, SFTP key card) |
| `csrf.ejs` | CSRF token provider (§6) |
| `ui/*` (`al-pagination`, `breadcrumb`, `stat-card`, `status-badge`, `empty-state`, `page-header`, `alert`) | TanStack Table pagination, Breadcrumb, Card/StatCard, Badge, EmptyState, PageHeader, Alert |

### 2.6 Error pages

`views/errors/error.ejs` stays for Express-side errors (500/404 during legacy passthrough). Migrated
pages use TanStack error boundaries + a React error page. The Express error handler is untouched.

---

## 3. Dependency plan

All new deps are added to a new `web/` workspace package (§7.1) with **exact pinned versions**
(`pnpm add --save-exact`). TanStack Start is at **1.0-RC** as of this writing — no loose ranges for
any TanStack package; versions are recorded in `web/package.json` comments. React is already a
transitive peer reality of the ecosystem but is **not** currently in the panel — React 19 is added
in `web/` only.

| Package | Why | Notes |
|---|---|---|
| `@tanstack/react-start`, `@tanstack/react-router` | Framework: SSR, file routes, server functions, loaders | Pin exact RC; Start is pre-1.0 |
| `@tanstack/react-query` | Server state over the existing REST API | Panel already ships `@tanstack/query-core` (vendored) — conceptual continuity |
| `@tanstack/react-table` | Server/user lists, file manager, logs, activity | |
| `react`, `react-dom` | React 19 | `web/` only |
| `tailwindcss` (+ `@tailwindcss/vite`) | Tailwind v4, matching current usage | v4.3.x; Vite plugin replaces the CLI for `web/`; the CLI build for legacy CSS is untouched |
| shadcn/ui (via `pnpm dlx shadcn@latest init --template start`) | Design system | Official TanStack Start preset; confirms `components.json` + `@/*` alias |
| `lucide-react` | Icons (shadcn default) | Replaces inline SVGs used by `ui.addSidebarItem` in addons |
| `zod`, `react-hook-form`, `@hookform/resolvers` | Forms/validation (server create, user mgmt, settings) | Panel already uses zod v4 server-side; `web/` can share patterns |
| `sonner` | Toasts (shadcn-recommended; parity with `window.showToast`) | |
| shadcn overlays: `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `command`, `tabs`, `table`, `form`, `skeleton`, `badge`, `breadcrumb`, `card` | Primitives for every migrated page | Added via `shadcn add` as needed |
| `recharts` | Analytics/player-stats charts | shadcn `chart` primitive is recharts-based; `chart.js` stays only on legacy passthrough pages |
| `xterm` (`@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`) | Real-time console — hard requirement, no `<textarea>` substitute | Already in root deps; hoisted to `web/` |
| `monaco-editor` | File editor | Already vendored/used; reuse |
| `reconnecting-websocket` | WS resilience | Already vendored; reuse |
| WS strategy | Native `WebSocket` via the existing token endpoint; socket events invalidate/update React Query cache (server status, console lines, file lists, backups progress) | No new WS lib beyond the reconnecting wrapper |
| i18n | **No new library** — reuse `storage/lang/*/lang.json` (§6.4) | Server-side `t()` in loaders/server functions + thin client `t()` |
| `@arclight/ui` (new workspace package) | Panel's published shadcn primitive library for addon v3 consumers (§4.3) | React 19 peer deps |

Deliberately **not** adopted: `@hotwired/turbo`, `@hotwired/stimulus` (retired on migrated pages;
Turbo remains only for legacy passthrough pages during the seam), a client i18n framework, a
WebSocket framework beyond the reconnecting wrapper.

---

## 4. Addon system compatibility (v3 — the highest-risk change)

### 4.1 Current state (fact base)

Addons receive an Express `Router` + `AddonApi` and contribute UI **server-side**: `renderView`,
`getComponentPath`, `ui.addSidebarItem` (inline SVG icons), `ui.addServerMenuItem`,
`ui.addServerSection`, `ui.registerSlot(slotId, fn → HTML string)`, `ui.registerDashboardWrapper`.
The store review contract (`docs/addon-ui-contract.md`) mandates rendering through the panel layout,
`window.modal.confirm`, `window.showToast`, nonce'd scripts, `al-*` classes. The bundled/installed
addons are **modrinth** (ships `views/desktop` + `views/mobile` EJS) and **parachute**, plus
`arclight-cloud` (admin settings page).

### 4.2 Decision (approved in grilling session, Q2)

**Addon UI moves to runtime-loaded React bundles; the entire server-side contract stays unchanged.**

- Addons keep: Express `Router` API routes, `prisma`, `config`, `permissions`, `commands`,
  `schedule`, `middleware.apiValidator`, `migrations`, lifecycle hooks — **1:1, untouched**.
- Addon **pages** become client routes; SSR for addon pages is lost (accepted trade-off, recorded
  here) unless an addon later opts into panel server functions.
- Addon **UI** becomes: a compiled bundle + a v3 manifest declaring contributions.

### 4.3 The v3 UI contract (proposal)

1. **`@arclight/ui`** — a new workspace package publishing the panel's shadcn primitives
   (Button, Card, Dialog, Toast, Table, Tabs, …) + theme tokens, with `react`/`react-dom`/
   `@tanstack/react-router` as peer dependencies. This is the only UI dependency an addon may import.
2. **Addon build** — the marketplace flow already runs `pnpm install && pnpm run build` per addon;
   addons gain a build step producing `dist/ui.js` (+ css) bundled against `@arclight/ui` peers
   (externalized, not inlined).
3. **v3 manifest contributions** (additive to the existing v2 manifest):
   ```jsonc
   {
     "ui": {
       "bundle": "dist/ui.js",
       "sidebar": [{ "id": "modrinth", "labelKey": "modrinth.sidebar", "icon": "box",
                     "to": "/modrinth", "section": "main", "order": 50 }],
       "serverMenu": [...],
       "slots": [{ "slot": "server.console.afterContent", "component": "ConsoleExtras" }],
       "routes": [{ "path": "/modrinth", "component": "BrowsePage" }]
     }
   }
   ```
   Per-locale labels come from the addon's own translation mechanism (the v2 contract already
   requires addon-owned localization — unchanged).
4. **Panel runtime loading** — the React shell imports registered bundles from
   `/addon-assets/<id>/dist/ui.js` via dynamic `import()` at startup, keyed on addon enable state.
   Bundles are served from `self` origin, so the production CSP (`script-src 'self' 'nonce-*'
   'strict-dynamic'`) is satisfied (verified in §9 risks).
5. **Slot rendering** — `ui.registerSlot` becomes a *server-side manifest of React components*
   rendered at the registered mount points in the React shell; the HTML-string callback form is
   dropped in v3.
6. **Sidebar/server-menu icons** — manifest references lucide icon names instead of inline SVG.
7. **Store policy** — store review switches to the v3 contract; `docs/addon-ui-contract.md`,
   `docs/addons.md`, `docs/addon-quickstart.md`, and `storage/addons/README.md` are rewritten in the
   same commit as the loader change (they are living docs per the contract).

### 4.4 Migration guide for addon authors (plan section — written at implementation time)

- Rewrite EJS views as React components against `@arclight/ui`.
- Move page data reads into the addon's own API routes (already exist) and fetch via TanStack Query.
- Convert `ui.addSidebarItem({icon: '<svg>'})` → `icon: "lucide-name"`.
- Replace `window.modal.confirm`/`window.showToast` with `@arclight/ui` `confirmDialog`/`toast`.
- Convert `ui.registerSlot(fn → html)` → declarative slot components.
- **Reference implementation:** the bundled `modrinth` addon is rewritten as the canonical v3 example
  and used to validate the store checklist; `parachute` and `arclight-cloud` are migrated after.

---

## 5. Migration strategy

### 5.1 Process architecture (approved, Q3)

**Two processes, one origin.**

```
Browser ──▶ TanStack Start server (public, PORT=3000)   [systemd: arclight-web]
                │  proxies /api/* /ws /assets /uploads /avatar /addon-assets/*
                ▼
            Express panel (internal, PANEL_INTERNAL_PORT=3001)  [systemd: arclight-panel]
                │  HMAC-signed HTTP/WS
                ▼
            arclightd daemons
```

- Express stays byte-for-byte identical; it only loses the public port and page rendering for
  migrated routes (the URL seam handles the rest).
- Sessions are SQLite-backed (`PrismaSessionStore`) → TanStack server functions can validate
  sessions directly; the proxy also forwards the session cookie untouched (same origin → no CORS,
  no cookie domain issues).
- The proxy must be **WebSocket-upgrade aware** for `/ws` (verified capability: TanStack's server
  exposes a standard `fetch` handler; the installer/`web` server uses an upgrade-capable proxy —
  flagged as the one infra risk in §9).
- Dev mode: `vite` dev server proxies `/api`, `/ws`, etc. to `nodemon` Express — two processes,
  same as today's DX.

### 5.2 URL-seam passthrough (approved, Q4)

- TanStack registers exactly the routes it owns (§2). Any URL it doesn't own falls through to
  Express via the proxy, which renders the legacy EJS page **at its existing URL** — URLs never
  change and the seam is invisible to users and bookmarks.
- Unmigrated pages keep their EJS nav (Turbo active there); migrated pages render the React shell.
  During the transition there are temporarily two nav implementations — accepted, and deleted as
  pages land.
- This is **temporary scaffolding** (not the rejected permanent hybrid): it dies when the last
  `views/` file is deleted.

### 5.3 Ordering (approved, Q4)

1. **Phase 1 — Auth + account:** login, register, 2FA, password reset, dashboard, account, credits
   (self-contained, high-traffic, low coupling). Proves session/CSRF/i18n plumbing end-to-end.
2. **Phase 2 — Admin:** overview → nodes → servers → users → images → API keys → settings →
   addons admin → databases/mounts/menu/activity/analytics/playerstats.
3. **Phase 3 — Server management:** manage, settings, startup, subusers, schedules, backups,
   databases, players, worlds.
4. **Phase 4 — Realtime, last:** file manager (monaco) and console (xterm + WS + Query cache).
5. **Phase 5 — Addons:** `@arclight/ui` + v3 loader + modrinth rewrite + guide + store docs.

Each phase ends green: `typecheck` + `test` + `lint` + Playwright, small conventional commits
(§7.4).

---

## 6. Auth / session / i18n handling

### 6.1 Sessions

Cookie + `PrismaSessionStore` (SQLite) unchanged. The React shell reads `/api/...` with the same
cookie via the proxy; TanStack server functions validate sessions by reading the DB store directly
(cross-process safe — verified).

### 6.2 CSRF

The existing `csrf-csrf` middleware stays authoritative on every Express mutation. The React app
obtains the token through the existing mechanism (embedded token endpoint / cookie double-submit
currently used by `views/components/csrf.ejs`); mutations from migrated pages carry it exactly as
EJS forms did. No relaxation of the middleware.

### 6.3 2FA

TOTP enrollment/verification and recovery codes stay in Express (`src/modules/user/twoFactor.ts`,
`src/modules/auth/auth.ts`). React only re-renders the setup and verify UIs. Feature parity is a
migration gate — never silently dropped.

### 6.4 i18n (10 locales)

Reuse `storage/lang/<locale>/lang.json` untouched. A shared `t()` implementation:
- Server side: loaders/server functions resolve the active locale (from panel settings, as today)
  and pass translated strings to components.
- Client side: a thin `t(key)` with the active locale's JSON fetched once, for dynamic strings
  (toasts, table empty states).
- Addon strings stay addon-owned (v2 contract), resolved via the panel-provided `t()`.

The existing "Adding a language string" workflow (`docs/DEVELOPMENT.md`) is preserved.

---

## 7. Build / deploy impact

### 7.1 Workspace & scripts

- Add `web/` as a workspace package (`pnpm-workspace.yaml` gains `"web"`): own `package.json`,
  own ESM `tsconfig.web.json` (`moduleResolution: bundler`, `jsx: react-jsx`, target ES2022+),
  Vite config. The root tsconfig (CommonJS, `moduleResolution: node10`) is untouched.
- New scripts in `web/`: `dev` (vite), `build` (TanStack build), `start` (TanStack prod server),
  `test` (Vitest + RTL), `typecheck`.
- Root scripts: `dev` additionally boots the `web/` dev server (via a tiny orchestration script);
  `start` (bun TUI) **unchanged**; `start:panel` gains `PANEL_INTERNAL_PORT`; new `start:web`.
- Tailwind: `web/` uses `@tailwindcss/vite`; the root CLI Tailwind build remains for legacy
  passthrough pages until the seam closes.

### 7.2 installer.sh + systemd

- Add a second systemd unit `arclight-web.service` (`ExecStart` runs the TanStack production server)
  alongside `arclight-panel.service`; update the install flow, the upgrade path, and the
  uninstall/cleanup sections.
- Env: add `PANEL_INTERNAL_PORT=3001` (Express) to `example.env`; public `PORT=3000` stays the
  TanStack entry. Document both in `docs/DEVELOPMENT.md`.

### 7.3 Version pinning

All TanStack + React + toolchain versions in `web/` are exact-pinned (TanStack Start is 1.0-RC;
`--save-exact`, no `^`), recorded in `web/package.json` comments and this plan. Root `package.json`
dependencies are untouched by this migration except as required by the seam.

### 7.4 Commit strategy

Conventional commits (per `CONTRIBUTING.md`), small scoped commits on
`feat/tanstack-start-migration` (e.g. `feat(web): scaffold tanstack start app`,
`feat(web): migrate login page`, `refactor(addons): introduce v3 UI manifest`). Never `main`.
Docs updates (`docs/DEVELOPMENT.md`, README run instructions) land on the same branch once the dev
workflow is finalized.

---

## 8. Testing plan

- **Existing 59 unit tests:** untouched and green until their page migrates. Source-inspection
  tests (`cspHeaders.test.ts`, `responsiveA11y.test.ts`, `elementIds.test.ts`,
  `iconVocabulary.test.ts`, …) assert exact strings in `views/` — they stay valid while views exist
  and are updated/retired in the same commit that deletes each view.
- **New `web/` suite:** Vitest + React Testing Library + MSW (mock the existing REST API).
  Component tests per migrated page; route tests with TanStack Router's test utilities; a shared
  MSW handler set mirroring `docs/specsheet.md` response shapes.
- **Playwright smoke (`smoke/`):** the "22-step journey" keeps running against the same URLs —
  now exercising the seam (React pages + legacy passthrough). Extended with React-specific
  assertions (hydration, Query cache states, console stream rendering).
- **Gates per commit:** `pnpm run typecheck` (root + web), `pnpm test` (root + web), `pnpm run lint`,
  Playwright on merged phases.

---

## 9. Risks & open questions

| # | Risk / question | Mitigation / status |
|---|---|---|
| R1 | **WS proxy upgrade** — the TanStack/`web` server must forward `Upgrade` headers for `/ws` to Express | Verified TanStack prod server exposes a fetch handler; use an upgrade-capable proxy (e.g. `http-proxy`/`ws` piping). Needs a spike early in Phase 1. |
| R2 | **TS 6.0.3 vs Vite/TanStack** — root is TS 6 + `moduleResolution: node10`; TanStack needs bundler resolution | `web/` pins its own TS (latest stable, verified compatible with Vite 6/7). Root tsconfig untouched. Verify in scaffold spike. |
| R3 | **CSP in dev** — Vite dev server + strict `script-src 'self' 'nonce-*' 'strict-dynamic'` | Dev-mode CSP handling: nonce-aware index or documented dev-only relaxation behind `NODE_ENV !== 'production'`. Production CSP unchanged. |
| R4 | **Addon bundles vs CSP** — runtime `import()` of addon bundles | Bundles served from `self` (`/addon-assets/<id>/`) satisfy `'self'` + `'strict-dynamic'`. Verified conceptually; validate with modrinth rewrite (Phase 5). |
| R5 | **SSR loss on addon pages** | Accepted trade-off (Q2). Documented in the v3 migration guide. |
| R6 | **Source-inspection tests coupled to views** | Retire/update in the same commit as each view deletion (§8). |
| R7 | **Seam nav duplication** (EJS nav + React nav coexist) | Accepted, temporary (§5.2). |
| R8 | **Addon store freeze** — store review must not accept v2 UI addons during the seam | Store policy: freeze new v2-UI submissions at cutover; v3 required after Phase 5. Needs maintainer sign-off. |
| R9 | **`parachute` addon status** — installed by `installer.sh` but not visible in `storage/addons/` | Confirm with maintainer: its v3 migration scope and timing. |
| R10 | **`/api/client` client API docs/UI** — external client surface | No UI migration needed (API-only consumers); document in the API docs page port. |
| R11 | **Turbo behavior on legacy pages during the seam** | Turbo stays active for passthrough pages; React pages disable it (Turbo bypass). No conflict once migrated pages are excluded from Turbo's scope. |
| R12 | **`installHeader.ejs`** — used by installer flows | Confirm whether any runtime route renders it; if unused outside the installer, it is not migrated. |

**Open questions — resolved during scaffold:**
- OQ-1: Store freeze policy → freeze at cutover, require v3 after Phase 5.
- OQ-2: `parachute` → deferred; `modrinth` rewritten as reference, parachute migrated after.
- OQ-3: Accept pinned TanStack 1.168.42 (post-RC) in production → accepted (SSR + Nitro adapter).
- OQ-4: `PANEL_INTERNAL_PORT=3001` → accepted, documented in `example.env`.

---

## 10. Decision log (grilling session — approved)

1. **End state:** full cutover — all 81 views migrate to React; `views/` deleted at the end; no
   permanent EJS surface (addons included).
2. **Addon strategy:** runtime-loaded React bundles; addon server-side contract untouched;
   `@arclight/ui` published; modrinth rewritten as reference; breaking change with migration guide.
3. **Process architecture:** separate TanStack Start server (public) + Express (internal port) with
   an upgrade-aware proxy; sessions read cross-process from the SQLite store.
4. **Cutover seam:** URL-seam passthrough — unmigrated URLs render as legacy EJS at the same URL;
   temporary scaffolding that dies with `views/`.
5. **Ordering:** auth/account → admin → server management → files/console → addons.
6. **i18n:** reuse `storage/lang` JSON; no new i18n library.
7. **Auth/CSRF/2FA:** Express-authoritative endpoints reused; React re-renders UI only.
8. **Charts:** recharts for migrated pages; chart.js only on legacy passthrough.
9. **Terminal/editor:** reuse vendored xterm, monaco, reconnecting-websocket; Query-cache
   integration for WS events.
10. **Testing:** web suite (Vitest + RTL + MSW); source-inspection tests retired with their views;
    Playwright journey extended; gates per commit.
11. **Build/deploy:** `web/` workspace package, pinned RC versions, second systemd unit,
    `PANEL_INTERNAL_PORT`, `example.env` + docs updated.

---

## 11. Phase 1 scaffold — outcomes

The initial scaffold (`feat/tanstack-start-migration` first commit) was executed after plan
approval. The following was produced:

### 11.1 Stack installed

| Package | Version (pinned exact) | Notes |
|---|---|---|
| `@tanstack/react-start` | 1.168.42 | Post-1.0; serves via Nitro (node-server preset) |
| `@tanstack/react-router` | 1.170.25 | File-based routing, `routeTree.gen.ts` auto-generated |
| `@tanstack/react-query` | 5.101.4 | Matches vendored `query-core` version already in the panel |
| `react`, `react-dom` | 19.2.8 | React 19 |
| `vite` | 8.2.1 | ESM bundler |
| `typescript` | 6.0.3 | Matches root TS version |
| `tailwindcss` | 4.3.3 | Matches root Tailwind version |
| `shadcn/ui` | 4.16.2 (Nova style) | Uses `@base-ui/react` primitives (not Radix); Geist font |
| `vitest` | 4.1.10 | Test runner, matches root |
| `@testing-library/react` | 16.3.2 | RTL for component tests |
| `msw` | 2.15.0 | API mocking for tests |

### 11.2 Architecture implemented

- **`web/` workspace package** added to `pnpm-workspace.yaml`; full TypeScript strict-mode config
  (bundler resolution, ESM, `@/*` alias → `./src/*`).
- **Vite dev proxy** configured (`web/proxy.config.ts` + `vite.config.ts`): `/api`, `/ws`,
  `/addon-assets`, `/avatar`, static paths, and all unmigrated legacy page prefixes proxy to
  `http://localhost:3001` (Express) with `ws: true` on `/ws`.
- **Production server** (`web/server/index.mjs`): zero-dependency Node proxy that spawns the Nitro
  server on `APP_INTERNAL_PORT=3002` and forwards API/WS/legacy paths to Express on
  `PANEL_INTERNAL_PORT=3001`. WS upgrade proven via standalone spike.
- **shadcn/ui Nova** initialized with `@base-ui/react` + Geist font + neutral base color. CSS
  variables declared in `@theme inline` + `:root`/`.dark` blocks. Components ready: `Button`.
- **Test infrastructure**: Vitest + jsdom + RTL + MSW + `@testing-library/jest-dom`; 3 smoke
  tests passing.
- **WS proxy spike** (`web/spikes/ws-proxy.mjs`): standalone, verifies the `net.connect` WS upgrade
  approach (passes).

### 11.3 Scripts (root)

- `pnpm dev:web` — Vite dev server (port 3000, proxies to Express on 3001)
- `pnpm build:web` — Vite build + Nitro server compilation
- `pnpm start:web` — Production server (node web/server/index.mjs)
- `pnpm typecheck:web` — `tsc --noEmit`
- `pnpm test:web` — `vitest run`

Root `pnpm run start` (bun TUI) is **unchanged**.

### 11.4 Next → Phase 1.1: Migrate auth pages

With the scaffold green, the next logical commit migrates the first real pages: login, register,
and password reset. Before that:

- Remove the demo index/about routes
- Add real auth endpoints (CSRF token fetch, session check)
- Rebuild the sidebar/nav shell (present in `__root.tsx`)
- Wire TanStack Query with auth state

### 11.5 Phase 1.1 & 1.2 — delivered (auth + dashboard)

**Phase 1.1 (auth)** — login, register, 2FA, forgot/reset migrated; additive
`GET /api/auth-config` (CSRF token + session user + branding). Method-aware
proxy rule: non-GET always reaches Express (session/CSRF authority).

**Phase 1.2 (dashboard + shell)** — `/_app` layout (auth gate + app shell),
dashboard page with server grid/list, folders (create/delete/pick/drag-drop),
pagination, daemon-offline banner, alerts, onboarding modal. Additive
`GET /api/dashboard` mirrors the EJS page data (servers + SWR daemon stats,
folders, nav) and serializes the addon-driven nav items (new optional
`iconName` on `SidebarItem` — additive to the addon contract; raw SVG kept
for addon icons). Folder mutations reuse the existing `/api/folders` REST
endpoints with CSRF headers. Shell nav is server-driven (uiComponentStore).

**Known deviations / notes**

- Live server-status badges: EJS gets them via the `/ws` realtime state
  cache; the React dashboard uses a 15s client refetch of `/api/dashboard`
  (server-side SWR caches make this cheap). Real-time WS wiring lands with
  the console/server phases.
- Dashboard live status was a stand-in; no polling loop exists server-side.
- base-ui Dialog focus management hangs under jsdom — dialog interactions
  are covered by the mutation-contract test; visual/browser verification is
  a follow-up (Chrome not available in this environment).
- shadcn components are base-ui (Nova) style — no `asChild`; use `render`
  props. `sonner` for toasts.

**Phase 1.2 review fixes**

- Onboarding skip/complete now dismiss the dialog (local `onboardingDismissed`
  state) and invalidate the dashboard query; the skip/complete POSTs moved to
  `web/src/lib/onboarding.ts` (CSRF-guarded, never rejects). A failed skip
  refetches with `needsOnboarding` still true, so the tutorial re-shows on the
  next visit — matching EJS.
- Dashboard empty state is admin-aware, mirroring `views/user/dashboard.ejs`:
  admins always get a create action pointing at `/admin/servers/create` even
  when the non-admin `canCreateServer` flag is false.
- Auth-page tests (login/2FA) needed explicit 5s waits: the initial router
  load can exceed the 1000ms default under full-suite CPU contention.

**Phase 1.3 — server pages (console + files), the real-time surfaces**

- Additive `GET /api/server/:id/context` serializes the server shell data for
  React: identity, primary address, limits, image features (post-EULA),
  install state, initial daemon status, the addon-driven server menu (with
  admin/owner/feature/permission filtering and `:uuid`/`:id` placeholders
  resolved server-side), and subuser permissions for action gating.
- Additive `GET /server/:id/files/content` (1 MiB + UTF-8 guards) backs the
  React file editor; the editor uses a textarea (Monaco stays on the EJS
  editor page — noted future enhancement).
- Realtime: `web/src/lib/realtime.ts` is a protocol-compatible TS client for
  `/ws/realtime` (sync cursor, ping/pong, watch/unwatch, reconnect
  resubscribe) that routes events into the TanStack Query cache
  (`['server-live', uuid]`) — the console's status/stats/queue render from it
  with no polling. Console terminal output streams via the existing
  `/console/:id` WS proxy (short-lived ws-token).
- Console page: xterm.js (npm `xterm` + fit + web-links addons) with log
  history, prompt masking, two-tab input ownership (Web Locks, released on
  unmount), reconnect/backoff, power controls (start/restart/stop + capacity
  queue + cancel), mandatory EULA gate, install/suspended/daemon-offline
  banners, and SVG sparkline usage cards.
- File manager: list/breadcrumb/filter/selection, create/delete/move/
  duplicate/archive/unzip/pull, XHR upload with progress, image preview, and
  the inline editor — all reusing the existing `/server/:id/files/*` REST
  endpoints with CSRF headers, gated by subuser permissions.
- URL seam: `/server/:uuid` and `/server/:uuid/files` now render in TanStack;
  every other `/server/*` path (settings, databases, schedules, backups,
  subusers, logs, worlds, players, files/edit, ws-token, file APIs) still
  routes to Express (proxy.config.ts + vite plugin + server/index.mjs).
  `/console` WS is forwarded in dev and prod.

**Known deviations / notes**

- Command autocomplete (`mc-autocomplete`, feature-gated) is not ported;
  the input remains plain. Monaco editor is not bundled (textarea editor
  instead). Chart.js sparklines replaced with lightweight SVG sparklines.
- `useServerStatusSnapshot` (REST `/status` poll) was removed as dead code;
  the realtime bus owns live state, matching the EJS manage page.
- Backup/restore progress toasts (EJS `showProgressToast` job polling) are
  replaced with simple success toasts + query invalidation; the persisted
  progress-poll endpoints (`/backups/progress`, `/backups/restore/progress`)
  remain available on Express if a richer progress UX is wanted later.
- The subuser permission modal shows labels without the EJS `permMeta`
  descriptions/icons; the label text is self-describing and the backend
  enforces all permission checks regardless.
- Schedule task add/remove posts immediately per task (the EJS batches
  pending tasks and saves them together); end state is identical.

---

## 12. Phase 1.5 — remaining user pages + full admin surface (delivered)

**Phase 1.5 (server + user + admin)** completes the view migration:

- **Server pages:** `worlds`, `players`, and the standalone file editor
  (`/server/:uuid/files/edit/{*path}` splat route). Additive
  `GET /api/server/:id/worlds` backs the worlds list (reuses the existing
  file APIs for delete/download). Players reuses the existing JSON data
  endpoint. The editor is a textarea route (Monaco stays on the EJS editor
  page — noted future enhancement, same as Phase 1.3).
- **User pages:** `account` (profile/images/history), `account/2fa/setup`,
  `credits`, `my-images` (+`edit/:id`), and `create-server` (with the
  image-driven port editor). Additive endpoints mirror the EJS render
  payloads: `GET /api/account`, `GET /api/account/2fa/setup`,
  `GET /api/account/credits`, `GET /api/account/my-images` (+edit),
  `GET /api/create-server`. Mutations reuse the existing `/account/*`,
  `/my-images/*`, and `/create-server` POST endpoints with CSRF headers.
- **Admin surface (the largest chunk, ~7,200 lines of EJS):** additive
  `GET /api/admin/context` (admin identity + addon-driven sidebar groups
  from `uiComponentStore.getAdminSidebarGroups()` + `require2faForAdmins`)
  and `GET /api/admin/page/:page` (per-page render data mirroring each EJS
  `res.render` payload). All admin mutations reuse the existing `/admin/*`
  POST/PUT/DELETE endpoints with CSRF headers; Express stays the mutation
  authority. 26 TanStack routes: overview, users (+create/edit/view),
  nodes (+create/edit at `/admin/node/:id`, stats at `/admin/node/:id/stats`,
  configure command), servers (+create/edit), images (+edit, approvals &
  egg-store tabs, export), apikeys, `/admin/api/docs`, databases (+create),
  settings (tabs), activity (paged log), analytics, playerstats, mounts,
  menu, addons (+store), and the admin shell layout + addon-driven sidebar.
- **URL seam:** `/admin` was removed from the legacy proxy; every admin GET
  now renders in TanStack. `/admin/images/export` is a targeted API proxy
  exception (restores the egg-export download).
- **CI:** `.github/workflows/ci.yml` now runs `arclight-web` typecheck, test,
  and build in the typecheck/test/build jobs.

**Known deviations / notes**

- `context.ts` gates on `isAuthenticated(true)` (admin-only, 2FA enforced) —
  the same level as most admin mutations. Per-page permission granularity
  (e.g. `arclight.admin.nodes.view`) is enforced by the server-side
  permission-filtered sidebar + page visibility rather than re-guarding each
  context case; the EJS render guards were page-level, the React shell hides
  inaccessible sections. Flagged for maintainer review if stricter
  per-page authorization is wanted.
- Legacy `/admin/*` JSON GET endpoints that only the (now-removed) EJS pages
  consumed (`/admin/images/list`, `/admin/images/store/catalogue`,
  `/admin/images/store/panel`, `/admin/check-update`, `/admin/node/:id/configure`)
  are orphaned in the React app: page reads come from the context endpoints
  instead. The endpoints remain on Express for API consumers. The node
  configure command is exposed to React via the `nodes-configure` context
  case (stats page Configure button).
- `views/admin/radar`, `security`, `uiComponents` have **no EJS views** —
  they are API-only modules (JSON endpoints), so nothing was dropped; their
  functionality was never a rendered page.
- The `admin/context` module sits mid-list in `src/modules/registry.ts`
  (admin group is 19 modules); `tests/featureRegistry.test.ts` asserts its
  actual position (index 11) and the api group start (index 19).

---

*Phase 1.5 complete — every EJS view (auth, user, server, admin) now renders
in TanStack Start; CI (typecheck/test/build/lint/semgrep, root + web) is
green. Remaining work: Phase 5 (addons v3) + deleting `views/`.*
