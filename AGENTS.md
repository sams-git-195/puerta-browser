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

| Task         | Command             |
| ------------ | ------------------- |
| Install deps | `bun install`       |
| Lint         | `bun lint`          |
| Typecheck    | `bun typecheck`     |
| Test         | `bun run test:unit` |
| Dev mode     | `bun dev`           |
| Format       | `bun format`        |

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
- Internal pages use the `puerta://` URL scheme; the _internal_ IPC API
  namespace is still called `flow` (`src/shared/flow/`, `window.flow`) —
  do not rename it.
- Animation imports use `motion/react` (not `framer-motion`).
- The `postinstall` script rebuilds native modules during `bun install`.
- On first launch the onboarding wizard must be completed before the main
  window appears.
