# Puerta Browser Fork Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the flow-browser fork into an independent GPLv3 project, Puerta Browser, with no upstream leakage, RPM packaging, agent files for Claude/opencode, seeded tests, and CI/PR infrastructure.

**Architecture:** Four sequential milestones, each an independent PR to `main`: (1) sever upstream identity/telemetry/CI coupling, (2) add RPM target, (3) agent files, (4) vitest + CI + PR template. No new subsystems — this is rebranding, removal, and infrastructure.

**Tech Stack:** Electron (castlabs fork), React 19, TypeScript, Vite/electron-vite, TailwindCSS 4, Bun, electron-builder 26, GitHub Actions, vitest (new).

**Spec:** `docs/superpowers/specs/2026-08-29-puerta-browser-init-design.md`

## Global Constraints

- Project name: **Puerta Browser**; product name `Puerta`; package name `puerta-browser`; executable `puerta`.
- appId / desktop-file base: **`io.github.sams_git_195.puerta`** (underscores — AppStream/D-Bus segments forbid hyphens).
- GitHub repo: `sams-git-195/puerta-browser` (verified via `git remote -v`). Upstream: `MultiboxLabs/flow-browser`.
- License stays **GPL-3.0** with upstream copyright intact; README must credit Flow Browser as origin.
- Author: Sam, `samheard95@gmail.com`.
- Package manager is **bun** — never npm/pnpm/yarn/node directly.
- The internal IPC API namespace `flow` (`src/shared/flow/`, `window.flow`) is **out of scope** — it is invisible to users; only the URL schemes `flow://`, `flow-internal://`, `flow-external://` are renamed.
- Verification for config/rebrand tasks (no test suite exists until Milestone 4): `bun run typecheck && bun run lint && bun run format` clean, plus `bun dev` launch where stated.
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`), matching repo history.
- All milestone work branches off `main`: `git checkout -b <branch>` per milestone.

---

## Milestone 1 — Sever upstream (branch: `feat/puerta-identity`)

### Task 1: Package + builder identity

**Files:**
- Modify: `package.json` (name, productName, description, author, nightly script)
- Modify: `electron-builder.ts` (appId, productName, executableName, publish owner)

**Interfaces:**
- Produces: package `name: "puerta-browser"`, `productName: "Puerta"` — later tasks (desktop files, README) assume these.

- [ ] **Step 1: Create the milestone branch**

```bash
git checkout main && git checkout -b feat/puerta-identity
```

- [ ] **Step 2: Edit `package.json` top fields**

Replace:

```json
  "name": "flow-browser",
  "productName": "Flow",
  "version": "0.12.0",
  "description": "A modern privacy-focused browser with a minimalistic design.",
  "author": {
    "name": "iamEvan",
    "email": "evan@iamevan.dev",
    "url": "https://iamevan.dev"
  },
```

with:

```json
  "name": "puerta-browser",
  "productName": "Puerta",
  "version": "0.1.0",
  "description": "Puerta Browser — your gateway to the internet. An open-source Chromium-based browser with side tabs, forked from Flow Browser.",
  "author": {
    "name": "Sam",
    "email": "samheard95@gmail.com"
  },
```

Also in `scripts`, change `start:nightly`'s `--name 'Flow Nightly'` to `--name 'Puerta Nightly'`.

- [ ] **Step 3: Edit `electron-builder.ts`**

- `appId: "dev.iamevan.flow"` → `appId: "io.github.sams_git_195.puerta"`
- `productName: "Flow"` → `productName: "Puerta"`
- `win.executableName: "flow"` → `"puerta"`
- `publish` block → `{ provider: "github", owner: "sams-git-195", repo: "puerta-browser", releaseType: "prerelease" }` (add explicit `repo` — the repo name no longer matches upstream's).

- [ ] **Step 4: Verify**

Run: `bun install && bun run typecheck && bun run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add package.json electron-builder.ts bun.lock
git commit -m "feat: rebrand identity to Puerta Browser, point updater at sams-git-195/puerta-browser"
```

### Task 2: Strip telemetry

**Files:**
- Delete: `src/main/controllers/posthog-controller/` (entire directory)
- Modify: `src/main/controllers/index.ts` (remove `import "./posthog-controller";`)
- Delete: `src/renderer/src/components/analytics/umami.tsx` (defined but never imported — confirmed dead)
- Delete: `src/renderer/public/umami.js`
- Modify: `package.json` (remove `posthog-node` dependency)

**Interfaces:** none — the controller is a side-effect import only; `UmamiScriptLoader` has zero importers (verified by grep).

- [ ] **Step 1: Delete posthog controller and its import**

```bash
git rm -r src/main/controllers/posthog-controller
```

In `src/main/controllers/index.ts` delete the line `import "./posthog-controller";`.

- [ ] **Step 2: Delete umami**

```bash
git rm src/renderer/src/components/analytics/umami.tsx src/renderer/public/umami.js
rmdir src/renderer/src/components/analytics 2>/dev/null || true
```

- [ ] **Step 3: Remove the dependency**

Remove `"posthog-node": "^5.29.2",` from `dependencies` in `package.json`, then `bun install`.

- [ ] **Step 4: Verify no dangling references**

Run: `grep -rni "posthog\|umami" src/ package.json --include="*.ts" --include="*.tsx" --include="*.json" | grep -v bun.lock`
Expected: no output. Then `bun run typecheck && bun run lint` — clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove PostHog and Umami telemetry — Puerta ships with zero analytics"
```

### Task 3: Rename URL schemes `flow://` → `puerta://`

**Files:**
- Modify: `src/main/controllers/sessions-controller/protocols/index.ts` (scheme registrations)
- Rename: `src/main/controllers/sessions-controller/protocols/_protocols/{flow,flow-internal,flow-external}/` → `{puerta,puerta-internal,puerta-external}/`
- Modify: `src/main/controllers/sessions-controller/protocols/static-domains/config.ts` and every file matching `grep -rl "flow://" src` (17 files, 27 occurrences at plan time — re-grep, don't trust the count)

**Interfaces:**
- Produces: schemes `puerta`, `puerta-internal`, `puerta-external`; user-visible URLs like `puerta://games`, `puerta://settings`. Task 6 (README) references `puerta://games`.

- [ ] **Step 1: Replace hyphenated schemes first (order matters — `flow-internal` contains `flow`)**

```bash
grep -rl "flow-internal\|flow-external" src --include="*.ts" --include="*.tsx" | xargs sed -i 's/flow-internal/puerta-internal/g; s/flow-external/puerta-external/g'
```

- [ ] **Step 2: Replace scheme URLs**

```bash
grep -rl "flow://" src --include="*.ts" --include="*.tsx" | xargs sed -i 's|flow://|puerta://|g'
```

- [ ] **Step 3: Replace bare scheme string literals — manually, not sed**

In `src/main/controllers/sessions-controller/protocols/`: change `scheme: "flow"` → `scheme: "puerta"`, `protocol.handle("flow", ...)` → `"puerta"`, `registerStaticDomainsRoutes("flow", app)` → `"puerta"`, `protocols.includes("flow")` → `"puerta"`, and any `protocol: "flow"` entries in `static-domains/config.ts`. Check each `grep -rn '"flow"' src --include="*.ts"` hit individually — do NOT touch identifiers (`registerFlowProtocol` may keep its name) or the `src/shared/flow/` API namespace (out of scope per Global Constraints).

- [ ] **Step 4: Rename protocol directories and fix imports**

```bash
git mv src/main/controllers/sessions-controller/protocols/_protocols/flow src/main/controllers/sessions-controller/protocols/_protocols/puerta
git mv src/main/controllers/sessions-controller/protocols/_protocols/flow-internal src/main/controllers/sessions-controller/protocols/_protocols/puerta-internal
git mv src/main/controllers/sessions-controller/protocols/_protocols/flow-external src/main/controllers/sessions-controller/protocols/_protocols/puerta-external
```

Update the remaining import in `protocols/index.ts`: `./_protocols/flow` → `./_protocols/puerta`. (The `flow-internal`/`flow-external` import paths were already rewritten by Task 3 Step 1's sed, since they contain the hyphenated strings — verify with `grep -n "_protocols" src/main/controllers/sessions-controller/protocols/index.ts`.)

- [ ] **Step 5: Verify and smoke-test**

Run: `grep -rn "flow://" src | wc -l` → expected `0`. Then `bun run typecheck && bun run lint` — clean. Then `bun dev`: complete/skip onboarding, type `puerta://games` in the omnibox — the games page must load; open settings — internal pages must render.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: rename internal URL schemes from flow:// to puerta://"
```

### Task 4: Linux desktop-integration files

**Files:**
- Rename+rewrite: `com.flow_browser.flow.desktop` → `io.github.sams_git_195.puerta.desktop`
- Rename+rewrite: `com.flow_browser.flow.metainfo.xml` → `io.github.sams_git_195.puerta.metainfo.xml`
- Rename: `com.flow_browser.flow.png` → `io.github.sams_git_195.puerta.png`

**Interfaces:** these root files serve Flatpak/AppStream packaging (currently unused after Task 5 drops the Flatpak job) — kept, rebranded, for a future Flathub submission.

- [ ] **Step 1: Rename all three with `git mv`, then rewrite the .desktop file:**

```ini
[Desktop Entry]
Name=Puerta
Comment=Your gateway to the internet
GenericName=Web Browser
Exec=run.sh %u
Icon=io.github.sams_git_195.puerta
Type=Application
StartupNotify=true
StartupWMClass=Puerta
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;application/pdf;x-scheme-handler/http;x-scheme-handler/https;
Actions=new-window;new-incognito-window;

[Desktop Action new-window]
Name=New Window
Exec=run.sh --new-window %u

[Desktop Action new-incognito-window]
Name=New Incognito Window
Exec=run.sh --new-incognito-window %u
```

- [ ] **Step 2: Rewrite the metainfo.xml**

Keep the existing XML structure; change: `<id>` and `<launchable>` to `io.github.sams_git_195.puerta` (+ `.desktop`), `<name>` to `Puerta`, `<summary>` to `Your gateway to the internet`, description paragraphs to describe Puerta (note it is a fork of Flow Browser), all `<url>` entries to `https://github.com/sams-git-195/puerta-browser` (+ `/issues` for bugtracker; drop the Discord contact URL), `<developer id="io.github.sams_git_195"><name>Sam</name></developer>`, and remove the `<screenshots>` block entirely (it hotlinks upstream's repo). Keep `<project_license>GPL-3.0-only</project_license>` and any release/content-rating sections, updating release entries to `0.1.0`.

- [ ] **Step 3: Check nothing references the old filenames**

Run: `grep -rn "com.flow_browser" . --exclude-dir=node_modules --exclude-dir=.git --exclude=bun.lock`
Expected: only hits inside `.github/workflows/build.yml` (removed in Task 5). Fix any others.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: rebrand Linux desktop entry and AppStream metainfo to Puerta"
```

### Task 5: CI — drop upstream-coupled jobs, Linux-first releases

**Files:**
- Modify: `.github/workflows/build.yml` (remove `build-flatpak` job; trim matrix)
- Modify: `.github/workflows/build-and-release.yml` (trim matrix to Linux)
- Modify: `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/*.md`

**Interfaces:** release workflow keeps `bun run build:linux -p always` — Milestone 2 relies on this leg to publish RPMs.

- [ ] **Step 1: `build.yml`** — delete the entire `build-flatpak` job (lines ~37–169, from `build-flatpak:` to just before `build:`). In `after-build-comment`, change `needs: [build, build-flatpak]` → `needs: [build]`. In the `build` job, trim the matrix to `os: [ubuntu-latest, ubuntu-24.04-arm]` and delete all steps guarded by `if: matrix.os == 'macos-*'` or `'windows-latest'` conditions (EVS installs/logins, mac/win build steps). Remove `dist/*.flatpak` from the artifact path list. Update the PR-comment text if it mentions Flatpak. Add a YAML comment at the top of the deleted sections' location: `# macOS/Windows builds removed — require Apple signing + Castlabs EVS credentials we don't have yet. Re-add from upstream history if credentials materialize.`

- [ ] **Step 2: `build-and-release.yml`** — trim matrix to `os: [ubuntu-latest, ubuntu-24.04-arm]`; delete the mac/win-conditional steps (Castlabs EVS install/login, `Build for macOS`, `Build for Windows`) and the mac/win secret env blocks; keep the flatpak-related apt packages out: change the Ubuntu build-deps line to `sudo apt-get install -y elfutils dpkg fakeroot` (drop `flatpak-builder`) and delete the `Setup Flatpak` step. Add the same explanatory comment as Step 1.

- [ ] **Step 3: `CODEOWNERS`** — replace contents with `* @sams-git-195`. In both `ISSUE_TEMPLATE` files, replace `Flow`/`Flow Browser` with `Puerta`/`Puerta Browser`.

- [ ] **Step 4: Verify** — `bunx yaml-lint .github/workflows/*.yml 2>/dev/null || python3 -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]"` — both files parse. Read the diff of both workflows end-to-end once: no step may reference a deleted matrix OS or the flatpak job.

- [ ] **Step 5: Commit**

```bash
git add .github
git commit -m "feat: drop Flatpak/mac/win CI legs, Linux-first releases, own CODEOWNERS"
```

### Task 6: README, CONTRIBUTING, attribution

**Files:**
- Rewrite: `README.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Rewrite `README.md`** with this content (screenshots intentionally dropped until Puerta has its own):

```markdown
# Puerta Browser

**Puerta** ("door" in Spanish) — your gateway to the internet.

A modern, open-source browser with side tabs, built on Chromium via Electron —
the Arc/Dia-style browsing experience, available on Linux.

[![GPLv3 License](https://img.shields.io/badge/License-GPL%20v3-yellow.svg)](https://www.gnu.org/licenses/gpl-3.0)

## Features

- **Side tabs & Spaces** — organize tabs into spaces in a collapsible sidebar.
- **Profiles** — separate settings and extensions per profile.
- **Command palette** — search the web, reopen history, jump anywhere.
- **Chrome extensions** — install from the Chrome Web Store.
- **Zero telemetry** — Puerta ships with no analytics of any kind.
- **Offline games** — `puerta://games` for when the internet is down.

## Install (Linux)

Download the AppImage, `.deb`, or `.rpm` from
[GitHub Releases](https://github.com/sams-git-195/puerta-browser/releases).

## Development

Prerequisites: Node.js 22+, [Bun](https://bun.sh) 1.2+, build-essential, python3.

```bash
bun install
bun dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

## Credits & License

Puerta Browser is a fork of [Flow Browser](https://github.com/MultiboxLabs/flow-browser)
by MultiboxLabs / iamEvan, continued independently after upstream maintenance stopped.
Enormous thanks to the original authors.

Licensed under the [GNU GPL v3.0](./LICENSE), as was the original.
```

- [ ] **Step 2: `CONTRIBUTING.md`** — replace the heading with `# Contributing to Puerta Browser`, the clone URL with `https://github.com/sams-git-195/puerta-browser.git`, `cd flow-browser` with `cd puerta-browser`, and any remaining `Flow` mentions with `Puerta` (`grep -n Flow CONTRIBUTING.md` to find them).

- [ ] **Step 3: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: rebrand README and CONTRIBUTING with Flow Browser attribution"
```

### Task 7: User-visible "Flow" strings in the app

**Files:**
- Modify: all renderer/main files with user-facing "Flow" text — find with `grep -rn "Flow" src/renderer/src src/main --include="*.tsx" --include="*.ts" | grep -vi "workflow\|overflow\|flow\.\|flow/\|flowInternal"` (19 renderer files at plan time; includes onboarding stages, settings about-card `value="Flow Browser"`, new-tab logo alt, `<title>` tags, "Set to Flow" default-browser button).

- [ ] **Step 1: Replace each user-visible occurrence** of `Flow Browser` → `Puerta Browser` and standalone product-name `Flow` → `Puerta`. Judgment rule: rename only strings a user can see (JSX text, `alt`, `title`, labels, toasts); leave identifiers, comments about the `flow` API, and third-party bundle files (`src/renderer/public/edge-surf-game-*` — vendored game code, skip it) untouched.

- [ ] **Step 2: Verify** — `bun run typecheck && bun run lint && bun run format` clean; `bun dev` → onboarding says "Puerta Browser", settings → About shows "Puerta Browser".

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: rebrand user-visible strings to Puerta"
```

### Task 8: Milestone 1 gate — PR + release

- [ ] **Step 1:** Full sweep: `grep -rni "multiboxlabs\|iamevan\|flow-browser\|flow_browser" . --exclude-dir=node_modules --exclude-dir=.git --exclude=bun.lock --exclude-dir="edge-surf-game*"` — remaining hits must only be: LICENSE/attribution contexts, README credits, `docs/` historical references, `src/shared/flow` API namespace, upstream git remote, and the electron-updater.yml text (check it: `grep -in flow .github/workflows/electron-updater.yml` — fix product mentions if any).
- [ ] **Step 2:** `bun run build:unpack` succeeds; launch `./dist/linux-unpacked/puerta` — executable is named `puerta`, app title is Puerta.
- [ ] **Step 3:** Push branch, open PR titled `feat: rebrand fork as Puerta Browser` (using the Milestone 4 PR-template checklist manually for now), merge after CI is green.
- [ ] **Step 4:** Tag `v0.1.0` on main only after Milestone 2 merges (so the first release already carries an RPM).

---

## Milestone 2 — RPM packaging (branch: `feat/rpm-target`)

### Task 9: Add RPM target and CI support

**Files:**
- Modify: `electron-builder.ts` (linux target + rpm block)
- Modify: `.github/workflows/build-and-release.yml` and `.github/workflows/build.yml` (add `rpm` to apt installs)

- [ ] **Step 1:** In `electron-builder.ts`: `linux.target: ["AppImage", "deb"]` → `["AppImage", "deb", "rpm"]`, and add alongside the `appImage` block:

```ts
  rpm: {
    artifactName: "${name}-${version}-${arch}.${ext}"
  },
```

- [ ] **Step 2:** In both workflows' Ubuntu build-deps step, add `rpm` to the `apt-get install -y` list (both x64 and, on the release workflow, confirm the ARM leg's package list too — fpm needs `rpmbuild` on every leg that emits RPMs).

- [ ] **Step 3: Local verification on Fedora:** precondition: `sudo dnf install rpm-build` (electron-builder's fpm needs `rpmbuild` locally too). Then `bun run build:linux` (unset publish: use `bun run build && bunx electron-builder --linux --publish never`). Expected: `dist/puerta-browser-0.1.0-x86_64.rpm` exists. Then `rpm -qip dist/*.rpm` shows name/license, and `sudo dnf install ./dist/*.rpm` → `puerta` launches, desktop entry appears; `sudo dnf remove puerta-browser` cleans up.

- [ ] **Step 4:** Commit, push, PR `feat: add RPM package for Fedora/RHEL`. After merge, run `build.yml` via workflow_dispatch and confirm an `.rpm` lands in the artifacts. Then tag `v0.1.0`.

```bash
git add electron-builder.ts .github
git commit -m "feat: add RPM package target for Fedora-based distros"
```

---

## Milestone 3 — Agent files (branch: `feat/agent-setup`)

### Task 10: Rewrite AGENTS.md; remove cursor/codex configs

**Files:**
- Rewrite: `AGENTS.md`
- Delete: `.cursor/`, `.clinerules` (symlink into `.cursor`), `.codex/`

- [ ] **Step 1: Rewrite `AGENTS.md`:**

```markdown
# AGENTS.md

Guidance for AI coding agents (Claude Code, opencode, and others) working on Puerta Browser.
Claude-specific model policy lives in `CLAUDE.md`.

## Overview

Puerta Browser is an Electron-based web browser (React 19, TypeScript, Vite,
TailwindCSS 4) with an embedded SQLite database (better-sqlite3 / Drizzle ORM)
and no external backend. It is a GPLv3 fork of Flow Browser.

## Prerequisites

- **Node.js v22+** (see `.nvmrc`)
- **Bun v1.2+** — the only package manager/runner for this repo.
  **Never use npm, pnpm, yarn, or bare node/vite commands.**
- **build-essential** and **python3** (native module compilation via node-gyp)

## Key commands

| Task           | Command         |
| -------------- | --------------- |
| Install deps   | `bun install`   |
| Lint           | `bun lint`      |
| Typecheck      | `bun typecheck` |
| Test           | `bun run test:unit` |
| Dev mode       | `bun dev`       |
| Format         | `bun format`    |

## Coding practices

- **Test what you change.** Add or update vitest tests (`tests/`) for any
  behavior change in testable code; run `bun run test:unit` before claiming done.
- **Keep code clean and readable, with brief explanatory notes where they help
  the next reader** — especially around Electron IPC boundaries, protocol
  handlers, and anything non-obvious.
- Keep changes small and typed; follow the existing patterns of the file you
  are editing.
- Before pushing: `bun run lint && bun run typecheck && bun run format` and
  `bun run test:unit` must all pass, or CI will fail.

## Gotchas

- The `electron` dependency comes from a Castlabs fork
  (`castlabs/electron-releases`) for Widevine DRM. This is normal.
- Internal pages use the `puerta://` URL scheme; the *internal* IPC API
  namespace is still called `flow` (`src/shared/flow/`, `window.flow`) —
  do not rename it.
- Animation imports use `motion/react` (not `framer-motion`).
- The `postinstall` script rebuilds native modules during `bun install`.
- On first launch the onboarding wizard must be completed before the main
  window appears.
```

(If Milestone 4 has not merged yet, keep the test bullets — they describe the target state and Milestone 4 lands next.)

- [ ] **Step 2: Remove other agent configs** (bun rule is now folded into AGENTS.md):

```bash
git rm -r .cursor .codex && git rm .clinerules
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: rewrite AGENTS.md for Puerta, drop cursor/codex configs"
```

### Task 11: CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`:**

```markdown
# CLAUDE.md

Read `AGENTS.md` first — it is the source of truth for setup, commands, and
coding practices. This file only adds Claude-specific policy.

## Model policy

- **Never use Haiku models** for subagents or any work in this repo.
- **Prefer Opus or Fable** for all non-trivial work (features, bug fixes,
  refactors, reviews).
- Sonnet is acceptable only for very simple mechanical changes: renames,
  formatting, single-line fixes, comment edits.
- When spawning subagents, apply the same rules to the subagent's model.

*(Note: the main session's model is chosen by the user in their client; these
rules govern what Claude controls — subagent model selection and
recommendations.)*

## Working style

- Write or update tests for behavior changes and run them (`bun run test:unit`)
  before claiming completion; validate with `bun typecheck` and `bun lint`.
- Keep code clean with brief explanatory notes where they help the next
  reader (see AGENTS.md → Coding practices).
- Use bun for everything; never npm/pnpm/yarn.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: add CLAUDE.md with model policy (no haiku; prefer opus/fable)"
```

### Task 12: opencode config

**Files:**
- Create: `opencode.json`

- [ ] **Step 1:** Verify current schema key names against https://opencode.ai/config.json (fetch it; opencode also reads `AGENTS.md` natively — confirm in their docs at opencode.ai/docs/rules). Then create `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-opus-4-5",
  "small_model": "anthropic/claude-sonnet-4-5",
  "instructions": ["AGENTS.md"]
}
```

Adjust key names/model ids to whatever the fetched schema actually specifies (e.g. if a newer Opus/Fable id exists, pin that). The intent to preserve: primary model Opus-class or better, no Haiku anywhere, Sonnet only as the "small" model for trivial work.

- [ ] **Step 2:** Commit; push branch; PR `chore: agent configuration for Claude and opencode`.

```bash
git add opencode.json
git commit -m "chore: add opencode config pinned to opus-class models"
```

---

## Milestone 4 — Tests, CI, PR template (branch: `feat/test-infra`)

### Task 13: Vitest + seed test (TDD)

**Files:**
- Create: `vitest.config.ts`, `tests/shared/utility.test.ts`
- Modify: `package.json` (devDep + script), `electron-builder.ts` (exclude tests from packaging)

**Interfaces:**
- Consumes: `getOriginFromURL(url: string): string` from `src/shared/utility.ts` (existing).
- Produces: `bun run test:unit` script — Task 14's CI job and the AGENTS/CLAUDE docs depend on this exact name. (Named `test:unit`, not `test`, because `bun test` invokes bun's own runner instead of the package script.)

- [ ] **Step 1: Install and configure**

```bash
bun add -d vitest
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    // Mirrors the "~" aliases in electron.vite.config.ts — check that file
    // and copy any alias the code under test imports.
    alias: {
      "~/shared": resolve(__dirname, "src/shared")
    }
  }
});
```

Add to `package.json` scripts: `"test:unit": "vitest run"`. In `electron-builder.ts` `files` array, add `"!{tests/**,vitest.config.ts}"`.

- [ ] **Step 2: Write the failing-first seed test** at `tests/shared/utility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getOriginFromURL } from "../../src/shared/utility";

describe("getOriginFromURL", () => {
  it("returns the hostname for http(s) URLs", () => {
    expect(getOriginFromURL("https://example.com/path?q=1")).toBe("example.com");
    expect(getOriginFromURL("http://sub.example.com:8080/x")).toBe("sub.example.com");
  });

  it("returns the input unchanged when it is not a valid URL", () => {
    expect(getOriginFromURL("not a url")).toBe("not a url");
  });
});
```

To honor the TDD red step with existing code: first run with a deliberately wrong expectation (`.toBe("wrong")`), confirm the runner fails, then restore the real expectations. This proves the test executes the code rather than passing vacuously.

- [ ] **Step 3: Run** `bun run test:unit` — expected: 2 tests pass. Then `bun run typecheck && bun run lint && bun run format` — still clean. `tests/` sits outside the tsc project includes so typecheck ignores it, and the test imports `describe/it/expect` explicitly so eslint needs no vitest-globals config. If eslint still errors on the new files, add a `tests/**` entry to `eslint.config.mjs` mirroring the existing TS file config rather than disabling rules.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests package.json bun.lock electron-builder.ts
git commit -m "feat: add vitest with seed tests for shared utilities"
```

### Task 14: CI test job

**Files:**
- Modify: `.github/workflows/checks.yml`

- [ ] **Step 1:** Add a `tests` job cloned from the existing `main-checks` job structure (same checkout/node/bun pinned-action steps and `bun install --development --frozen-lockfile`), whose final step is:

```yaml
      - name: Run Unit Tests
        run: bun run test:unit
```

- [ ] **Step 2:** Validate YAML parses (same python3 one-liner as Task 5 Step 4). Commit:

```bash
git add .github/workflows/checks.yml
git commit -m "ci: run unit tests on every PR and push to main"
```

- [ ] **Step 3:** After merge, in GitHub repo settings enable branch protection on `main` requiring the `main-checks`, `format`, and `tests` checks. (Manual step for Sam — record it in the PR description.)

### Task 15: PR template

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create the template:**

```markdown
## Summary

<!-- What does this PR do, and why? -->

## Related issue

<!-- Link the issue this addresses, or delete this section. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Docs / CI / tooling

## Checklist

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run format` produces no diff
- [ ] `bun run test:unit` passes (tests added/updated for behavior changes)
- [ ] Screenshots attached for UI changes
- [ ] I license this contribution under GPL-3.0
```

- [ ] **Step 2:** Commit; push; PR `feat: test infrastructure, CI test job, PR template`.

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add pull request template"
```

---

## Deferred (tracked, not in this plan)

- Puerta icon/logo design (door motif) — Flow art remains temporarily.
- macOS/Windows builds (need Apple certs + Castlabs EVS credentials).
- Flathub submission under `io.github.sams_git_195.puerta`.
- Electron main-process test harness + Playwright e2e.
- Renaming `build/dock-tile-plugin/` (macOS-only; revisit with the macOS phase).
