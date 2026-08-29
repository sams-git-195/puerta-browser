# Puerta Browser — Fork Initialization Plan

**Date:** 2026-08-29
**Status:** Draft — awaiting Sam's approval
**Scope:** Turn the unmaintained MultiboxLabs/flow-browser fork into an independent, open-source project called **Puerta Browser** ("door" in Spanish — your gateway to the internet), with proper agent tooling, CI, tests, PR template, and Fedora (RPM) packaging.

---

## Guiding principle

The asks split into two groups, and the ordering matters:

- **Load-bearing (do first):** things that silently misbehave while the fork carries upstream's identity — the auto-updater, telemetry, Flathub CI, and app identifiers. These must change *before* the first Puerta release, because they're nearly free to change pre-users and painful after.
- **Cosmetic / infrastructure (do second):** naming, README, agent files, tests, CI polish, RPM target.

## Milestone 1 — Sever upstream, safe to release

Goal: the repo can cut a `v0.1.0` release under the Puerta identity with zero upstream leakage.

### 1.1 Auto-updater (highest priority)

[electron-builder.ts:126](electron-builder.ts) has `publish: { provider: "github", owner: "multiboxlabs" }`. As shipped, every installed Puerta build would poll **upstream's** releases and "update" users onto Flow. Change owner/repo to Sam's GitHub fork (`sams-git-195/puerta-browser` — verify exact repo slug during implementation).

### 1.2 Telemetry — strip by default

- `src/main/controllers/posthog-controller/index.ts:22` hardcodes upstream's PostHog key (`phc_P8uP…`, eu.i.posthog.com).
- `src/renderer/src/components/analytics/umami.tsx` points at `https://umami.iamevan.dev` with upstream's website id.

Every Puerta user's analytics and error reports would go to the old maintainer. **Recommendation: remove both integrations entirely** (delete the umami component + `src/renderer/public/umami.js`, and stub/remove the posthog controller). A privacy-focused browser with no telemetry is also a selling point. Sam can re-add his own keys later if he wants opt-in analytics.

### 1.3 App identity — functional identifiers

These change runtime behavior and data locations, so they land now, pre-first-release:

- `appId`: `dev.iamevan.flow` → assumed **`io.github.sams-git-195.puerta`** style (open question below — a personal domain would beat this).
- `productName`: `Flow` → `Puerta`; package `name`: `flow-browser` → `puerta-browser`. Note: productName drives the Electron `userData` directory, so a Flow install's profile data won't carry over — acceptable for a fresh project, worth one line in the README.
- `executableName`: `flow` → `puerta` (win + linux).
- Linux desktop-integration files: `com.flow_browser.flow.desktop`, `.metainfo.xml`, `.png` → renamed to the new appId and re-authored (name, developer, URLs, screenshots removed or replaced).
- `package.json` author block → Sam (samheard95@gmail.com); description updated.
- `build/dock-tile-plugin/` (`FlowDockTilePlugin.m`, Info.plist) — macOS-only; rename or leave for the macOS phase (see 1.5).
- `scripts/temp-change-name` nightly script — update or drop `start:nightly`.

**`flow://` URL scheme** (settings pages, games, internal routes — wired through `src/main/controllers/sessions-controller/protocols/`, tabs controller, and renderer routes): **Recommendation: rename to `puerta://` now** as part of this milestone, since it's user-visible ("puerta://games") and only gets harder to change. It's a mechanical find-and-replace across a bounded set of files plus the scheme registration. Flagged as an explicit decision point.

### 1.4 CI — remove upstream-coupled jobs

- **Flatpak job in `build.yml`** clones `flathub/com.flow_browser.flow` (upstream's Flathub packaging). It will produce wrongly-branded flatpaks or break outright. **Drop the job**; re-add if/when Puerta is submitted to Flathub under its own id.
- **`build-and-release.yml`**: the macOS legs need Apple signing certs + Castlabs EVS credentials and upstream's `build/profile.provisionprofile`; the Windows leg needs EVS too. Sam has none of these secrets. **Recommendation: trim the release matrix to Linux (x64 + arm64) for now**, keep the mac/win steps in a clearly-commented disabled state (or a separate branch of the matrix gated on secrets existing), and go Linux-first. Windows unsigned builds could be re-enabled later; macOS needs an Apple Developer account.
- `electron-updater.yml` (the Electron-version-bump bot) — keep; it's self-contained. Update its PR body text if it mentions Flow.
- `.github/CODEOWNERS` → Sam. Issue templates → rebrand while in there.

### 1.5 Licensing & attribution (keeps it honestly open source)

- LICENSE is **GPLv3** — the fork must stay GPLv3. Keep the existing license file and upstream copyright notices intact.
- New README: Puerta identity, but with a visible "Puerta is a fork of [Flow Browser](https://github.com/MultiboxLabs/flow-browser) by MultiboxLabs/iamEvan, continued independently" credit section.
- Remove dead badges (CodeRabbit, DeepWiki) and upstream release links; update install instructions to Sam's releases page.
- Logo/icons (`build/icon.*`, `favicon.png`, `assets/`): keep Flow's art temporarily with a tracked task to design a Puerta icon (a door motif is an obvious direction), or do a quick recolor now. Flagged as an open question.

## Milestone 2 — Fedora / RPM packaging

- Add `"rpm"` to `linux.target` in [electron-builder.ts:115](electron-builder.ts) → `["AppImage", "deb", "rpm"]`, plus an `rpm` artifact-name block matching the deb/AppImage pattern.
- CI: verify the ubuntu-latest release leg can emit RPMs — electron-builder uses fpm, which needs `rpmbuild` present; add `rpm` to the `apt-get install` line (the ARM leg installs fpm but not rpm — check both). Verify via a `workflow_dispatch` run that an `.rpm` artifact actually appears.
- Local smoke test on Sam's Fedora machine: `bun run build:linux`, `dnf install ./dist/*.rpm`, launch, confirm desktop entry and icon.
- RPM metadata: license `GPL-3.0`, category, description, post-install scripts default from electron-builder (fine for v1).

## Milestone 3 — Agent setup (Claude + opencode)

Single source of truth: **`AGENTS.md`** (opencode reads AGENTS.md natively; Claude Code reads it via CLAUDE.md pointer — verify opencode doc claim during implementation).

- **Rewrite `AGENTS.md`**: keep the accurate stack/commands/gotchas content, delete the "Cursor Cloud" section, fold in the bun-not-npm rule currently in `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`, and add a "Coding practices" section: test-first where tests exist, keep changes small and typed, run `bun lint && bun typecheck && bun format` before pushing, keep code clean and readable with brief explanatory notes where they help the next reader (Sam's stated preference), follow existing patterns.
- **New `CLAUDE.md`** (thin): points at AGENTS.md, plus Claude-specific policy:
  - **Never spawn Haiku subagents.**
  - **Prefer Opus or Fable** for all non-trivial work; Sonnet acceptable only for very simple mechanical changes (renames, formatting, single-line fixes).
  - Always create/run tests for behavior changes; run typecheck + lint before declaring done.
  - Honest caveat recorded in the file: model choice for the main session is user-selected — these rules bind subagent spawning and recommendations, which is what Claude actually controls.
- **New `.opencode/` config** mirroring the same model preferences in opencode's format (opencode reads AGENTS.md for instructions; its `opencode.json` can pin preferred models).
- **Remove** `.cursor/`, `.clinerules` (symlink into `.cursor/`), and `.codex/` after folding their useful content into AGENTS.md.

## Milestone 4 — Tests, CI rules, PR template

- **Test framework: vitest** (fits the electron-vite + bun + TS stack). Seed with real unit tests over `src/shared/` utilities (pure TS, no Electron runtime needed), add a `"test": "vitest run"` script, and wire a `test` job into `checks.yml`. Testing main-process/Electron code and Playwright e2e is real work — scoped as a labeled later phase, not front-loaded here.
- **`checks.yml`**: keep typecheck/lint/format jobs, add the test job. Add branch protection guidance (require checks on PRs to main) — a GitHub settings step for Sam, noted in docs.
- **`.github/PULL_REQUEST_TEMPLATE.md`**: summary, linked issue, type of change, and a checklist mirroring CI — `bun typecheck`, `bun lint`, `bun format`, `bun test`, screenshots for UI changes, note on GPLv3 (contributions are GPLv3).
- **`CONTRIBUTING.md`**: rebrand, describe the PR flow and the agent-file conventions.

## Open questions (assumptions I'll proceed with unless overridden)

1. **appId/domain**: assuming `io.github.sams-git-195.puerta` (no personal domain known). If Sam owns a domain, reverse-domain it instead.
2. **`flow://` → `puerta://`**: recommended yes, now. Say the word if you'd rather defer.
3. **Telemetry**: recommended full removal rather than re-keying.
4. **mac/win releases**: parked until signing credentials exist; Linux-first.
5. **Icon**: keep Flow art temporarily vs. quick placeholder Puerta icon now.
6. **Repo slug**: assuming the GitHub repo is (or will be) `sams-git-195/puerta-browser`.

## Execution order

1. Milestone 1 (sever upstream) — one PR, reviewed carefully; tag `v0.1.0` after.
2. Milestone 2 (RPM) — small PR + workflow_dispatch verification.
3. Milestone 3 (agent files) — small PR.
4. Milestone 4 (tests/CI/PR template) — one PR, vitest seeded.

Each milestone lands independently; nothing in 2–4 blocks on 1 except the release tag.
