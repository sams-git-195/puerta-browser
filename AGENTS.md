# Puerta Browser — Agent Guide

Guidance for AI coding agents (Claude Code, OpenCode, and others) working on Puerta Browser.
Claude-specific model policy lives in `CLAUDE.md`.

## Product context

- Puerta ("door") is an open-source, **zero-telemetry** desktop browser with side tabs and spaces
  (the Arc/Dia style), built on Chromium through Electron, **Linux-first** (AppImage / deb / rpm,
  x64 + arm64). A GPL-3.0-only fork of Flow Browser (MultiboxLabs), continued independently.
  No external backend — all user data is local.
- Stack: Electron 41 (Castlabs fork, Widevine) · React 19 · TypeScript 6 · electron-vite 5 / Vite 8 ·
  Tailwind 4 · shadcn / Radix / Base UI · SQLite (better-sqlite3 + Drizzle) · Hono (protocol
  handlers) · Vitest 4 · Bun. Prerequisites: Node 22+ (`.nvmrc`), Bun 1.2+, build-essential and
  python3 (node-gyp compiles native modules).

## How we work

**Full process: `.agents/rules/claude-agent-protocol.md` — read it before your first task.**
(Claude Code loads it through `CLAUDE.md`; every other harness reads it explicitly.) The
short version, which holds even if you read nothing else:

- **The main agent leads.** There is no project-manager agent: the session talking to the
  user plans, dispatches the specialists below, tracks their evidence, and reports back.
  Prefer dispatching. For a small, quick, single-discipline change with no risk surface, the
  main agent may do it directly — after reading that specialist's file and following its
  rules, workflow and self-check.
- **Open permissions, user-gated actions.** Agents may edit any file and run any command the
  task needs, and commit freely. They `git push`, open or merge PRs, deploy / ship / publish
  (tagging or pushing a `v*` tag — `git push origin v*`, `git push --tags` — a tag push publishes
  a GitHub release; `gh release *`; `gh workflow run *`; publishing builds with `-p always` or
  `--publish`; `bun run script:use-stock-electron`; `bun run script:upgrade-electron-to-*`;
  `bun run reset`), or delete / destroy anything — and write to the user's real profile
  (`~/.config/Puerta`) — **only when the user has said so in this conversation**, and when the
  user has said so, they do it without asking again. Not asked yet → finish, commit, and offer
  the exact command. There is no shared database to migrate: migrations run on each user's
  local SQLite. Local secret files (`.env`, git-ignored, none today) may be read and updated;
  their values never reach a commit, a log, or a report.
- **Stay in your lane.** Each agent focuses on what it owns (table below). A small adjacent
  edit the task needs is fine and gets named in the report; anything larger goes to its owner.
- **Senior ladder before any code:** (1) does this need to exist? (2) is it already in this
  codebase — reuse it; (3) does an installed dependency do it; (4) can it be one line;
  (5) only then the minimum that works — **without** dropping error handling, graceful
  user-facing errors, or any part of the user experience.
- **Evidence, not claims.** Gates are run and their output quoted. Unknown product rules are
  asked, never guessed.
- **Reports to the user:** Direct with technical summary depth, protocol §7 shape (outcome
  first, structured, no preamble).

## Agent team

| Agent                                         | Focus (owns)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Hands off to                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Main agent** (the session itself — no file) | Plans, dispatch, tracking, small direct changes; `AGENTS.md`, `CLAUDE.md`, `.agents/**`, agent files, `opencode.json`; **shared root files** — `package.json`, `bun.lock`, `.github/workflows/**`, `electron-builder.ts`, `electron.vite.config.ts`, lint / format / tsconfig / vitest config, `drizzle.config.ts`, `build/**`, `scripts/**`, `patches/**`, the `io.github.sams_git_195.puerta.*` packaging files, the release bump — which it edits itself or assigns to one builder at a time | all agents                      |
| product-specialist                            | Specs: requirements, flows, edge cases, abuse analysis (persisted to `docs/superpowers/specs/` on request) — no code, no tech design                                                                                                                                                                                                                                                                                                                                                            | architect, main agent           |
| architect                                     | Technical design + threat model (persisted to `docs/superpowers/specs/` on request) — no code                                                                                                                                                                                                                                                                                                                                                                                                   | fullstack-developer, main agent |
| fullstack-developer                           | All feature code: `src/main/**`, `src/preload/**`, `src/renderer/**` (hand-written files), `src/shared/**`, generated migrations in `drizzle/**`, `tests/**` for its own change, and the technical docs a change touches                                                                                                                                                                                                                                                                        | qa-tester, main agent           |
| qa-tester                                     | The quality signal after every implementation task; regression tests in `tests/**`; 🟣 entries in `documentation/known-issues.md` — never fixes production code                                                                                                                                                                                                                                                                                                                                 | main agent                      |
| code-reviewer                                 | Independent review of a diff, on the user's request; logs minor issues to `documentation/known-issues.md`                                                                                                                                                                                                                                                                                                                                                                                       | main agent                      |

**Hot files** (every new `flow.*` API touches them — sequence, never edit in parallel):
`src/shared/flow/flow.ts`, `src/preload/index.ts`, `src/main/ipc/index.ts`, `src/main/controllers/index.ts`,
`src/main/saving/db/schema.ts` + `drizzle/**`, `src/main/modules/basic-settings.ts`,
`src/shared/layers.ts` + `src/renderer/src/css/layers.css`, `src/renderer/src/index.css`.
There is one builder, so backend and UI work queue behind each other; run concurrent builders in separate git worktrees.

Claude Code: agents live in `.claude/agents/*.md`, permissions in `.claude/settings.json`.
OpenCode: the same team in `.opencode/agents/*.md`, permissions in `opencode.json`; the main
agent is OpenCode's default `build` agent. When a convention changes, update both sets
together — same roster, same rules, same policy.

## Dev commands

| Task                 | Command                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install deps         | `bun install` (`postinstall` rebuilds native modules; CI uses `--frozen-lockfile` — commit `bun.lock` with dependency changes)                                                                                                                               |
| Dev mode             | `bun dev` (or `bun dev:watch`) — runs against the **real** profile; agents verify with the run-puerta skill instead                                                                                                                                          |
| Typecheck            | `bun run typecheck` (node + web tsconfigs)                                                                                                                                                                                                                   |
| Lint                 | `bun run lint` (`eslint --cache .`)                                                                                                                                                                                                                          |
| Format               | `bun run format` (`prettier --write .`); read-only check: `bunx prettier --check .`                                                                                                                                                                          |
| Unit tests           | `bun run test:unit` (vitest, `tests/**/*.test.ts`); one file: `bunx vitest run tests/shared/glance.test.ts`                                                                                                                                                  |
| Build (gate)         | `bunx electron-vite build && bun run script:prune-frontend-routes` — bundle to `out/`, ~5 s, **run from the repo root**; the prune removes the gitignored route files the build generates, which `prettier --check` would otherwise flag (CI never has them) |
| Full build / package | `bun run build` (typecheck + build + route prune); `bun run build:linux -p never` packages locally — never without `-p never`                                                                                                                                |

- **Quality gates: typecheck, lint, format check, unit tests and the build must all pass on
  every change** — tests included, not only when a risk surface is touched. CI
  (`.github/workflows/checks.yml`) runs typecheck + lint, tests, and format (`bun run format`
  then `git diff --exit-code`) as separate jobs on every PR and push to `main`; `build.yml`
  builds the Linux packages on PRs. Baseline today: 6 test files / 29 tests green.
- `bash scripts/lint-z-index.sh` is not in CI and currently exits 1 with 6 pre-existing hits
  (`src/renderer/src/components/ui/popover.tsx`, `src/renderer/src/routes/bangs/page.tsx`, `src/renderer/src/routes/history/page.tsx`). Add no new ones.
- **Verify by running** (unit tests only reach pure TypeScript): follow
  `.claude/skills/run-puerta/SKILL.md` — build, launch against an isolated profile copy, drive it
  with the Playwright REPL.

## Critical gotchas

- **Bun only** — never npm / pnpm / yarn, never bare `node` / `vite` commands. CI pins Bun 1.3.10 and Node 22.
- **The `electron` dependency is a Castlabs fork** (`castlabs/electron-releases`, Widevine DRM). Normal.
  `script:use-stock-electron` drops Widevine (only the arm64 CI leg uses it) — never run or commit its result.
- **Names that must not change:** the internal IPC namespace is still `flow` (`window.flow`, `src/shared/flow/`,
  `Flow*API` types, `flow.db`, `FLOW_DATA_DIR`, preload id `flow-preload`); the public URL schemes are
  `puerta://`, `puerta-internal://`, `puerta-external://`. Identity chain: package `puerta-browser`, productName
  `Puerta`, appId `io.github.sams_git_195.puerta` (underscores), linux executable `puerta`, desktop file
  `puerta.desktop`.
- **Zero telemetry is a product promise.** No analytics, crash reporting, or new outbound request to a server
  that is not the user's own choice. Existing network use: the content-blocker lists, the GitHub update feed,
  extension / Web Store features. Anything new is a risk-surface change — ask first.
- **GPL-3.0-only.** Keep upstream copyright headers and `LICENSE`; the README credits Flow Browser and
  electron-browser-shell; new dependencies must be GPL-compatible.
- **`window.flow` exists on every site.** `src/preload/index.ts` is registered as a frame preload on the default
  session and every profile session (`nodeIntegrationInSubFrames: true`), so access control is only the
  location-based `hasPermission()` / `wrapAPI()` there. The `ipcMain` handlers (~135 in `src/main/ipc/**`)
  mostly do **not** check the sender — validate arguments in the handler, and give every new API the narrowest
  permission (`"all"` needs a written reason). Never loosen `sandbox`, `contextIsolation`, `webSecurity`,
  `nodeIntegration` in `src/main/controllers/tabs-controller/tab.ts`. The session permission handler grants
  every web permission except `openExternal` (which prompts) — do not widen what internal pages can do.
- **Adding an IPC API touches six places:** interface in `src/shared/flow/interfaces/**`, global type in
  `src/shared/flow/flow.ts`, implementation + `wrapAPI` permission in `src/preload/index.ts`, handler in
  `src/main/ipc/**` (channel naming `namespace:kebab-action`, pushes `namespace:on-*`), its import in
  `src/main/ipc/index.ts`, and the renderer consumer (usually a provider in `src/renderer/src/components/providers/`).
- **Adding an internal page needs three things:** a route folder `src/renderer/src/routes/<name>/` (`config.tsx` +
  `page.tsx`), an entry in `STATIC_DOMAINS` (`src/main/controllers/sessions-controller/protocols/static-domains/config.ts`),
  and a `hasPermission()` case in the preload if it calls `flow.*`. Update `docs/references/urls.md`.
- **Generated files — never hand-edit:** `src/renderer/route-*.html` and `src/renderer/src/routes/*/main.tsx` (gitignored,
  regenerated on every electron-vite config load); `src/renderer/src/lib/omnibox-new/bangs.ts` (from
  `bun run script:sync-bangs`; excluded from eslint and prettier); `drizzle/meta/*` and applied `drizzle/*.sql`.
- **Layering:** page content is native `WebContentsView`s, so CSS z-index can never lift UI above a tab. Use only the
  semantic utilities (`z-base|elevated|controls|scrim|modal|popover|tooltip|max`) or `UILayer.*`; a new layer goes
  in `src/shared/layers.ts` **and** `src/renderer/src/css/layers.css`. Overlays above tab content use portal
  component windows (`src/renderer/src/components/portal`, `docs/components/portal.md`); the omnibox stays topmost.
- **Page bounds are declarative** (`PageLayoutParams`, `design/DECLARATIVE_PAGE_BOUNDS.md`) — never
  `getBoundingClientRect` for page bounds.
- **Animation imports use `motion/react`** (not `framer-motion`). React Compiler is on.
- **Onboarding gate:** on first launch the wizard must finish before any browser window appears; incoming URLs are
  dropped until then (`src/main/app/urls.ts`).
- **Remotes and tags:** `origin` = `sams-git-195/puerta-browser`, `upstream` = `MultiboxLabs/flow-browser` (never
  push there). `gh` always takes `--repo sams-git-195/puerta-browser` (forks default to upstream). Local tags
  include upstream Flow's (a local `v0.1.0` is _not_ Puerta's) — use `git ls-remote --tags origin`, never `git tag`,
  and never `git push --tags`.
- **Release:** version lives in `package.json`; `io.github.sams_git_195.puerta.metainfo.xml` `<releases>` is the only
  changelog (commit `chore: release vX.Y.Z`). Pushing a `v*` tag publishes — user-gated. Known open problem:
  releases are published as prereleases (`electron-builder.ts` `releaseType: "prerelease"`) and `electron-updater`
  ignores prereleases, so installed apps never see updates — do not "fix" it unasked.
- **Privacy of the dev profile:** `.claude/skills/run-puerta/.data/` is a gitignored copy of the real
  `~/.config/Puerta` (cookies, history). Never read, print, grep or commit it.
- **Docs drift:** trust the code. Known stale: `CONTRIBUTING.md` (says Electron 35), `docs/contributing/hot-reloading.md`
  (`bun run dev:server` does not exist), `docs/api/browser.md` and `docs/api/tabs/tab.md` (describe classes that no longer
  exist), `docs/references/view-indexes.md`, `design/LAYERING_SYSTEM.md` (`ViewLayer` was never built), and the READMEs under
  `src/main/ipc/` and `src/main/controllers/` in places. `docs/superpowers/` holds dated specs and plans and is excluded from prettier.
- **Superpowers plugin:** if it is active, its brainstorming / planning skills may be used, but this protocol wins
  on any conflict (user-gated list, lanes, report shape).

## Architecture

- **Processes.** Main: `src/main/index.ts` → `src/main/browser.ts`. `controllers/` are singletons whose side effects run on
  import (order set in `src/main/controllers/index.ts`; `bookmarks-controller` is imported from `src/main/browser.ts`). `ipc/` registers the handlers.
  `modules/` holds settings schema (`src/main/modules/basic-settings.ts`, Electron-free so it is testable), content blocker, extensions,
  favicons, `src/main/modules/output.ts` (`debugPrint` / `debugError`). `saving/` holds the DB and JSON stores. Preload: `src/preload/index.ts`
  builds every `flow.*` API. Renderer: `src/renderer/src/` — one folder per page in `routes/` (14 today), plus `components/`
  (`ui/` shadcn, `browser-ui/`, `browser-sidebar/`, `providers/`), `hooks/`, `lib/`, `css/`. Shared: `src/shared/` (types,
  `flow/` API interfaces, pure helpers). Aliases: `@` → `src/main` (main, preload) or `src/renderer/src` (renderer); `~` → `src/shared`.
- **IPC example, end to end** (`flow.bookmarks.getData()`): `src/shared/flow/interfaces/browser/bookmarks.ts` →
  `src/preload/index.ts` (`ipcRenderer.invoke("bookmarks:get-data")`, wrapped with `wrapAPI(bookmarksAPI, "browser")`) →
  `src/main/ipc/browser/bookmarks.ts` → `src/main/controllers/bookmarks-controller/` → `getDb()` →
  `src/renderer/src/components/providers/bookmarks-provider.tsx`.
- **Protocols.** `puerta://` (new-tab, error, about, games, omnibox, extensions, history, bangs, pdf-viewer), `puerta-internal://`
  (main-ui, popup-ui, settings, omnibox, onboarding), `puerta-external://` (games). Hono apps in
  `src/main/controllers/sessions-controller/protocols/_protocols/`; static files via `src/main/controllers/sessions-controller/protocols/static-domains/serve-static.ts`.
  Web-content profile sessions get `puerta` and `puerta-external` only; the default session gets all three.
- **Trust model.** Untrusted: web pages and their frames. Trusted: `puerta-internal://` pages and the main process.
  `puerta://new-tab`, `history`, `omnibox`, `extensions` are partly privileged through `hasPermission()`. CORS is opened
  for requests from `puerta*` pages (`src/main/controllers/sessions-controller/intercept-rules/cors-bypass-custom-protocols.ts`) — keep it scoped to them.

## Product rules

Defaults live in `src/main/modules/basic-settings.ts`; changing one is a product decision — ask.

| Rule              | Value                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab sleep         | `sleepTabAfter` default **1h** (5m–24h or never); bookmark / pinned-associated tabs can sleep                                                                                                                                         |
| Tab archive       | `archiveTabAfter` default **12h** (24h, 7d, 30d, never); ephemeral (bookmark / pinned-associated) tabs are never archived                                                                                                             |
| Glance            | `glanceEnabled` default **on**; a page's foreground new-tab open (`target=_blank`) becomes a glance unless it came from a split pane; promote or dismiss (`src/shared/glance.ts`)                                                     |
| Split view        | **2–4** tabs (`MAX_SPLIT_GROUP_TABS = 4`, `src/main/ipc/browser/tabs.ts`); fewer than 2 dissolves the group; equal columns, gap 10 px                                                                                                 |
| Bookmarks         | Dia-style: one tree per profile shown in every space; a bookmark acts like a pinned tab with an ephemeral live tab per space; ✕ closes the live tab, never the bookmark; spec `docs/superpowers/specs/2026-08-29-bookmarks-design.md` |
| Toolbar           | `toolbarPosition` default **sidebar** (alt `top`); `sidebarSide` default left (right is experimental)                                                                                                                                 |
| Other defaults    | `newTabMode` omnibox · `commandPaletteOpacity` tinted · `contentBlocker` disabled · `autoUpdate` on · `syncTabsAcrossWindows` off · `enableFlowPdfViewer` off · `enableMv2Extensions` off                                             |
| Profiles / spaces | Initial profile id `main`; spaces belong to a profile and carry a per-space theme colour; incognito = internal ephemeral profile, cleaned at startup                                                                                  |
| Sync              | `⚠️ undecided — not built`. Direction on record: per-device op-log in a user-chosen folder, no Puerta server, never cookies or sessions (`docs/superpowers/specs/2026-08-29-sync-research-memo.md`)                                   |
| Platforms         | Linux releases only; macOS / Windows builds are parked until signing credentials exist                                                                                                                                                |

## UI

- **Design direction: existing design system — fidelity, not restyle.** Puerta inherits Flow's shadcn (new-york, zinc)
  look: oklch tokens and `@theme inline` in `src/renderer/src/index.css` (`:root` / `.dark`), per-space gradient via
  `--space-background-start/end`, Inter on a system-ui stack. Reuse the components, tokens and motion already in the
  repo and extend them in their own idiom; do not propose a new look.
- Tokens: `src/renderer/src/index.css` and `src/renderer/src/css/` · components: `src/renderer/src/components/ui/`
  (shadcn via `components.json`; Radix umbrella `radix-ui`; popovers on `@base-ui/react`) · class merge: `cn` from
  `@/lib/utils` · toasts: `sonner` · icons: `lucide-react` (space icons use Phosphor via `src/renderer/src/lib/phosphor-icons.tsx`) ·
  theming: `ThemeProvider` toggles `.dark` / `.light` (`src/renderer/src/components/main/theme.tsx`) · per-OS styling via
  `platform-linux|darwin|win32` variants (`src/renderer/src/components/main/platform.tsx`).
- **Window sizes to verify** (this is a desktop window, not a phone): normal browser window min **800×400**
  (default 1280×720), popups min 300×200, settings min 800×600; check light and dark, and both toolbar positions
  (`sidebar` / `top`). No i18n layer — user-facing strings are hard-coded English; do not introduce one unasked.
- Generic-looking UI is a defect here: the Design bar in the fullstack-developer's agent file applies
  to every screen, whoever builds it.

## Data layer (SQLite, Drizzle, JSON stores)

- Schema: `src/main/saving/db/schema.ts`; migrations `drizzle/` (latest `0004`), applied automatically on first
  `getDb()` (`src/main/saving/db/index.ts`); if `migrate()` throws, the app cannot start. DB file:
  `app.getPath("userData")/flow.db` (WAL). **Open the DB only through `getDb()`** — the one other SQLite store is
  `favicons.db` via knex in `src/main/modules/favicons.ts`. JSON stores go through `src/main/saving/datastore.ts`.
- **Migrations run on real users' data at upgrade — the expensive mistake is a migration that loses it.** Follow
  `docs/contributing/migrations.md`: change `schema.ts`, run `bunx drizzle-kit generate --config drizzle.config.ts --name <snake_case>`
  from the repo root, read the generated SQL (SQLite `ALTER TABLE` is limited; table recreation must copy data),
  commit schema + SQL + `drizzle/meta/*` together. Never edit, rename or delete an applied migration, never hand-edit
  `drizzle/meta/_journal.json`, `--custom` is an escape hatch. Test against a copy of a populated `flow.db`, not only a fresh one.
- Everything under `userData` is unencrypted (tabs and navigation history, history, bookmarks, cookies in `Profiles/<id>/`).
  Never log or print its contents.

## Documentation

Plain-English living docs in `documentation/` (see protocol §4): `README.md` index +
`pages/<page>.md` + `features/<feature>.md` + `known-issues.md`. Updated by whoever makes the
change, confirmed by the main agent before any feature is Done; qa-tester verifies. Written
for humans and future model sessions with zero context. Developer-facing docs stay in `docs/`
and `design/`; specs and plans in `docs/superpowers/{specs,plans}/` (dated file names).
