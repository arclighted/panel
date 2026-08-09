# Contributing to Arclight Panel

Thanks for your interest in contributing! Arclight Panel is maintained by a single maintainer ([radityprtama](https://github.com/radityprtama)), so clear, small, well-tested changes are appreciated more than large sweeping ones.

Please read this guide and the [developer guide](docs/DEVELOPMENT.md) before starting.

---

## Ground rules

- **Small, focused PRs.** One feature or fix per pull request. Large refactors are hard for a solo maintainer to review.
- **Test your changes.** Run `pnpm run typecheck` and `pnpm test` before opening a PR. Add tests for new behavior — see `tests/` for existing patterns.
- **Follow the existing style.** The codebase is TypeScript (strict), EJS, and Tailwind. The ESLint config in `eslint.config.mjs` is enforced by `pnpm run lint`.
- **Don't break the daemon contract.** The panel and the daemon (`arclightd`, a separate repository) communicate over an HMAC-signed protocol. Header names (`X-Arclight-*`), the `Basic Arclight:` auth scheme, and permission identifiers (`arclight.api.*`, `arclight.admin.*`) must stay in sync between both repos — changing one side silently breaks the other.
- **Keep `git mv` for renames** so history is preserved.

---

## Getting started

1. **Fork** the repository on GitHub.
2. **Clone** your fork:

   ```bash
   git clone https://github.com/arclighted/panel.git
   cd panel
   ```

3. **Install dependencies:**

   ```bash
   pnpm install
   ```

4. **Set up the environment:**

   ```bash
   cp example.env .env
   # Edit .env: PORT, URL, SESSION_SECRET, DATABASE_URL
   ```

5. **Create a branch:**

   ```bash
   git checkout -b feat/your-feature
   ```

---

## Development workflow

```bash
pnpm run dev          # Dev server with auto-restart
pnpm run typecheck    # TypeScript typecheck (all configs)
pnpm run lint         # ESLint (fixes in place)
pnpm test             # Vitest unit tests
pnpm run build        # Production build (tsc + prisma + tailwind)
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for project layout, architecture, and how to run the daemon locally.

---

## Commit conventions

Use [conventional commits](https://www.conventionalcommits.org/):

```
feat(api): add batch server suspension endpoint
fix(console): escape ANSI sequences in the terminal view
refactor(addons): extract manifest validation
docs(contributing): explain the daemon contract
test(backups): cover cloud download failure path
chore(deps): bump prisma to 7.x
```

- `feat` / `fix` / `refactor` / `docs` / `test` / `chore` are the most common types.
- Scope in parentheses is the area touched (e.g. `api`, `console`, `addons`, `files`, `tui`).

---

## Pull request checklist

Before opening a PR, verify:

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm test` passes (all 59 test files)
- [ ] `pnpm run lint` reports no errors
- [ ] New behavior has test coverage
- [ ] No unrelated formatting churn in the diff
- [ ] Any UI change keeps the responsive/accessibility bar (see `tests/responsiveA11y.test.ts`)
- [ ] If you touched the panel↔daemon protocol, the daemon repo was updated in tandem

---

## Reporting bugs

Open an issue using the [bug report template](.github/ISSUE_TEMPLATE/BUG-REPORT.yml) with:

- Panel version and how it was installed
- Node/pnpm versions and OS
- Steps to reproduce
- Relevant logs (`journalctl -u arclight-panel -f`)

---

## Security

This project takes security seriously (Semgrep SAST in CI, CSP with nonces, HMAC-signed daemon traffic). If you find a vulnerability, **do not open a public issue** — email the maintainer directly. See [`docs/SECURITY.md`](docs/SECURITY.md).
