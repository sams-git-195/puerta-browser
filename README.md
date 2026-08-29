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
