# Cross-Device Sync — Research Memo

Date: 2026-08-29
Status: recommendation, no implementation planned yet

## The question

How should Puerta keep a user's browsing environment in sync across devices?

## Constraints from where the codebase is today

State is split across **three stores with no sync affordances**:

| Store | Location | Contents |
|---|---|---|
| SQLite (`flow.db`) | Drizzle/better-sqlite3 | tabs, tab groups, window states, pinned tabs, history (+ bookmarks once built) |
| JSON `DataStore` | `datastore/…` | settings, spaces, profiles, onboarding, shortcuts |
| `localStorage` | renderer | sidebar width, UI state |

No table carries `updatedAt` on most rows, there are no delete tombstones, and
there is no change-log. Any sync design has to add one of those first —
"just copy the files" cannot merge two devices that both changed state.

Product constraints: Puerta promises **zero telemetry and no backend**;
it targets Linux first; the user base (for now) is one person with a few
machines. A hosted sync service is both out of character and out of budget.

## What to sync (and what not to)

Worth syncing, in value-per-effort order: **bookmarks, settings, pinned
tabs, spaces** (small, low-churn, user-curated). Maybe later: history
(append-mostly, large), open tabs ("send tab to device" is more useful than
full tab-state sync and much simpler). Never: cookies/sessions (Chromium
profile internals are machine-bound and syncing them is a security trap),
extensions (store metadata could sync; binaries reinstall per device).

## Options considered

### A. Per-device operation logs in a user-chosen synced folder — recommended

Puerta writes an append-only JSONL op-log per device
(`<syncFolder>/puerta-sync/<deviceId>.jsonl`), one line per mutation
(`{ts, deviceId, entity, entityId, op: "upsert"|"delete", data}`). The user
points that folder at whatever they already use — Syncthing, Nextcloud,
Dropbox, a USB stick. On startup and on file-watch events, Puerta replays
other devices' logs and applies ops idempotently with last-writer-wins per
entity (ts + deviceId tiebreak). Periodic log compaction into a snapshot
file keeps replay cheap.

Why this shape wins here:

- **Each device only ever writes its own file**, so the sync transport never
  sees write conflicts — the class of bug that makes naive file sync eat data.
- No server, no accounts, no telemetry — the user owns the transport.
  This is also what Zen users do today (syncing the profile via Syncthing),
  minus the corruption risk of syncing a live SQLite file.
- The op-log doubles as the missing change-log/tombstone layer, without
  reworking existing tables: controllers already funnel mutations through
  single choke points (`PinnedTabsController`, settings `setSettingValueById`,
  the future `BookmarksController`), so emitting an op per mutation is a
  small, local change.
- LWW is honest about its tradeoff: concurrent edits to the *same* bookmark
  on two offline devices resolve to the newer one. For user-curated,
  low-churn data that is the accepted norm (it is what Chrome does for most
  datatypes).

Optional hardening: encrypt log lines with a user passphrase (libsodium
secretbox) for users whose sync folder lives on a third-party cloud drive.

### B. CRDT library (automerge/yjs) over the same folder

Solves concurrent-edit merging "properly" (e.g. two devices reordering the
same bookmark folder). Cost: a heavyweight dependency, a second
representation of every synced entity, and merge semantics that still need
per-entity design. Not worth it before there is evidence LWW loses data in
practice. The op-log format above does not preclude moving to CRDTs later —
the choke points and deviceId/ts metadata are the hard part and carry over.

### C. Firefox-Sync-style hosted service (or self-hosted server)

Best UX ceiling (real-time push, send-tab, E2E encryption as designed), but
requires running infrastructure, accounts, and key management — against the
project's no-backend promise and unjustifiable at current scale. Revisit only
if Puerta grows a user base that asks for it.

### D. Sync the whole profile directory with Syncthing (no code)

What power users do today. Rejected as a *recommendation*: syncing a live
WAL-mode SQLite file between running instances corrupts it, and JSON
datastore files get clobbered whole-file (last write wins at file
granularity, silently). Fine as a manual "migrate to a new machine while
Puerta is closed" story — worth a docs paragraph, nothing more.

## Recommendation

Adopt **Option A**, phased:

1. **Phase 0 (prereq):** route all mutations of the to-be-synced entities
   through their controllers (already true) and add a `SyncLog` module that
   those controllers call. Ship it dark — writing a local op-log costs
   nothing and creates the change history sync needs.
2. **Phase 1:** "Sync folder" setting; write own log, ingest peer logs for
   **bookmarks + settings**. LWW, compaction, a paranoid `.backup` before
   first ingest.
3. **Phase 2:** pinned tabs + spaces (space themes included).
4. **Phase 3 (optional):** passphrase encryption; "send tab to device" as a
   one-shot op type — this covers most of what people actually want from
   open-tab sync.

Non-goals at every phase: syncing cookies/sessions, live tab state, or
anything through a Puerta-operated server.
