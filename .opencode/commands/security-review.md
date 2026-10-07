---
description: Security review of the pending changes on the current branch, tuned to Puerta's IPC, web-content and data surfaces. Reports findings, edits nothing.
agent: qa-tester
---

Run a security review of the pending changes on the current branch (`git diff main...HEAD` plus
uncommitted changes). You report; you make **no code edits** and take no user-gated action.

Read `AGENTS.md` (Critical gotchas, Architecture → Trust model) first. Puerta is an Electron
browser: web pages are untrusted, `window.flow` is injected into every page, and the main
process holds all privilege. Check the diff — and the code it calls — for:

1. **IPC / preload trust boundary.** Every new or changed `flow.*` API: is its `wrapAPI` permission the
   narrowest that works (`all` needs a written reason)? Does its `ipcMain` handler validate every
   argument and act only on ids / paths / URLs the main process resolves itself? Is anything
   privileged (Electron objects, Node handles, file paths, other profiles' data) returned to a page?
2. **Web-content isolation.** `webPreferences` in `src/main/controllers/tabs-controller/tab.ts`
   (`sandbox`, `contextIsolation`, `webSecurity`, `nodeIntegration`); the session permission handler;
   `puerta*://` protocol handlers and static serving (path traversal, which session gets which scheme);
   the CORS rewrite for `puerta*` pages; any new route in `STATIC_DOMAINS`.
3. **URL and scheme handling.** `loadURL`, `shell.openExternal`, `shell.openPath`, drag-and-drop and
   OS-supplied URLs: `javascript:`, `file:`, `data:` and custom schemes validated before use.
4. **Injection and unsafe rendering.** Page-derived strings (titles, URLs, favicons) reaching
   `dangerouslySetInnerHTML` / `innerHTML`; `webContents.executeJavaScript` built from data; `eval` /
   `new Function`; shell commands built from input.
5. **Secrets and data exposure.** Credentials (GitHub token, Castlabs EVS login, `APPLE_API_KEY_DATA`)
   in code, workflows or logs; browsing data (URLs, history, cookies) in logs; anything reading or
   writing the user's real profile (`~/.config/Puerta`) or the run-puerta `.data/` copy.
6. **Zero telemetry.** New `fetch` / `net.request` / `http(s)://` / `WebSocket` calls, analytics or
   crash-reporting dependencies, new outbound hosts. The promise is: no analytics of any kind.
7. **Data safety.** Drizzle migrations that can lose rows or stop the app starting (edited applied
   migrations, table recreation without a data copy, hand-edited `drizzle/meta/_journal.json`); writes outside
   `getDb()`; incognito (ephemeral profile) data reaching persistent storage.
8. **Release and supply chain.** Changes to `electron-builder.ts`, `.github/workflows/**`
   (publishing, permissions, `-p never` on PR builds), `package.json` dependencies (new, unpinned,
   GPL-incompatible, install scripts), extension / Web Store handling.

Report each finding as `file:line`, a one-line description, the attack or failure scenario, and a
light from the team scale: 🔴 Blocker · 🟠 Should fix · 🟡 Nit · 🔵 FYI · 🟣 Minor (a 🟣 is also logged
to `documentation/known-issues.md` with a fix prompt). Separate confirmed findings from
"unverified concerns". End with a verdict: `PASS` (no 🔴 or 🟠) or `FAIL`.
