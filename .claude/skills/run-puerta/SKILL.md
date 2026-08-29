---
name: run-puerta
description: Use when you need to build, launch, screenshot, or drive the Puerta Electron browser for verification — including when a plain launch crashes with zygote/GPU errors, when keyboard shortcuts don't fire under Playwright, or when a test run must not touch the real ~/.config/Puerta profile.
---

# Run Puerta

Puerta is an Electron browser (Castlabs fork, dev build in `out/`). For
agent/automated use, drive it via the Playwright REPL at
`.claude/skills/run-puerta/driver.mjs`. The driver launches with the flags
that actually work on this machine and against an **isolated copy** of the
user's data dir — never the real `~/.config/Puerta`.

All paths relative to the repo root.

## Prerequisites (once)

```bash
cd .claude/skills/run-puerta && bun install
```

## Build

```bash
cd <repo-root> && bunx electron-vite build   # ~5s, outputs to out/ (fails if run from any other directory)
```

Rebuild after every source change — the driver runs `out/`, not `src/`.

## Run (agent path)

```bash
tmux new-session -d -s puerta -x 200 -y 50
tmux send-keys -t puerta 'cd <repo-root> && node .claude/skills/run-puerta/driver.mjs' Enter
timeout 15 bash -c 'until tmux capture-pane -t puerta -p | grep -q "driver>"; do sleep 0.3; done'
tmux send-keys -t puerta 'launch' Enter
timeout 90 bash -c 'until tmux capture-pane -t puerta -p | grep -q "main-ui page:"; do sleep 0.5; done'
tmux capture-pane -t puerta -p | tail -5
```

For scripted (non-interactive) verification, import `playwright-core` from
this directory's `node_modules` and copy the `electron.launch(...)` options
verbatim from `driver.mjs` — they encode all the gotchas below.

### Commands

| command | what it does |
|---|---|
| `launch` | seed isolated data dir (first time), launch, wait for main UI |
| `reset-data` | re-seed `.data/` fresh from `~/.config/Puerta` (quit first) |
| `windows` | list all pages/webContents URLs |
| `eval <js>` | evaluate in the main browser-UI renderer (`flow.*` API lives here) |
| `evalin <url-substr> <js>` | evaluate in the page whose URL matches |
| `data` | `flow.tabs.getData()` — ground truth for tab/group assertions |
| `ss-page <url-substr> [name]` | screenshot ONE webContents → `shots/` |
| `key <url-substr> <keyCode>` | send a key through the real input pipeline (e.g. `key example.com Escape`) |
| `quit` | close app, exit |

Useful `eval` one-liners: `flow.tabs.newTab("https://example.com", true)`,
`flow.settings.setSetting("toolbarPosition", "top")`,
`flow.settings.getSetting("sleepTabAfter")`.

## Run (human path)

```bash
bun dev   # real profile, real window — not for automation
```

## Gotchas (all empirically hit on this machine)

- **Launch flags:** the sandboxed zygote crashes on this kernel
  (`zygote_host_impl_linux.cc CHECK failed`), and `--no-sandbox` alone kills
  the GPU process (`GPU process launch failed: error_code=1002` → FATAL).
  **`--no-sandbox --no-zygote` together** is the working combination.
- **Pass the repo root as the app arg and set `cwd` to it** — Drizzle
  migrations resolve relative paths; launching `out/main/index.js` directly
  fails with "Can't find meta/_journal.json".
- **Data isolation via `XDG_CONFIG_HOME`** (Electron derives userData from
  it on Linux). When seeding a copy of the profile, copy `flow.db-wal` and
  `flow.db-shm` too — the WAL holds recent rows; without it tabs are missing.
- **CDP key injection bypasses `before-input-event`.** Playwright's
  `keyboard.press` never triggers Electron app shortcuts; use the driver's
  `key` command (`webContents.sendInputEvent`) instead.
- **Screenshots don't composite.** Tab content, glance overlays, and portals
  are separate WebContentsViews stacked natively; `ss-page` captures one
  view only. Assert behavior via `data` / DOM, not pixels.
- **Error dialogs:** without an `uncaughtException` listener Electron shows
  a blocking modal on the user's screen; the driver installs one at launch.
- **Cleanup: `pkill -9 -x electron`**, never `pkill -f electron` — the `-f`
  pattern matches your own shell's command line and kills it mid-script.
- **Onboarding gate:** a blank profile shows the onboarding wizard before
  any browser window; the seeded copy carries the completed-onboarding flag.
