# Bookmarks — Design Spec

Date: 2026-08-29 (revised same day: Dia-style live-tab semantics per Sam)
Status: approved direction, implementing
Branch: `feat/bookmarks`

## Goal

A bookmarks ("favourites") system in the Dia mold: a compact tree of saved
pages in the sidebar, rendered **below the pinned-tab grid and above the tab
list**, with folders and plain bookmarks freely mixed. Profile-scoped
(decided): one bookmark tree per profile, visible in every space.

**Behavior model (revised): a bookmark acts like a pinned tab, not a
shortcut.** Clicking a bookmark activates its live tab if one exists in the
current space, or creates one (ephemeral — hidden from the tab list) and
associates it, exactly like the pinned-tab grid. Closing the live tab returns
the bookmark to its idle state; the bookmark row reflects active and
**sleeping** state. Bookmark tabs participate in automatic tab sleeping
("unload to save RAM"): a background bookmark tab unloads after the
`sleepTabAfter` interval and its row shows the moon indicator; clicking wakes
it. Each space gets its own instance (one associated tab per space), matching
pinned tabs.

Not in scope for v1: a bookmarks manager page, import from other browsers,
bookmark tags/search, a bookmarks bar in the topbar, per-space trees, sync.

## Data model

New SQLite table `bookmarks` (Drizzle migration `0004`), one row per node —
folders and bookmarks share the table, discriminated by `kind`:

```ts
export const bookmarks = sqliteTable(
  "bookmarks",
  {
    uniqueId: text("unique_id").primaryKey(),          // nanoid, like pinned tabs
    profileId: text("profile_id").notNull(),
    parentId: text("parent_id")                        // null = top level
      .references((): AnySQLiteColumn => bookmarks.uniqueId, { onDelete: "cascade" }),
    kind: text("kind").$type<"bookmark" | "folder">().notNull(),
    title: text("title").notNull(),
    url: text("url"),                                  // null for folders
    faviconUrl: text("favicon_url"),                   // null for folders
    position: integer("position").notNull(),           // ordering among siblings
    createdAt: integer("created_at").notNull()         // unix seconds
  },
  (table) => [
    index("idx_bookmarks_profile_id").on(table.profileId),
    index("idx_bookmarks_parent_id").on(table.parentId)
  ]
);
```

- `onDelete: "cascade"` on the self-FK makes folder deletion remove the whole
  subtree in one statement (mirrors the `history_visits` FK pattern).
- Position uses the same float-then-normalize convention as tabs/pinned tabs:
  insert at `siblingCount` or midpoint, renumber on reorder.
- Folder nesting is unlimited in the schema; the UI indents up to 5 levels
  and clamps deeper drops to level 5 (deep nesting is a non-goal).

## Main process

`BookmarksController` (`src/main/controllers/bookmarks-controller/index.ts`),
modeled on `PinnedTabsController` (profile-scoped, immediate writes, in-memory
cache, typed events):

- `loadAll()` at startup; cache `Map<uniqueId, BookmarkNode>`.
- CRUD: `create(profileId, {kind, title, url, faviconUrl, parentId?, position?})`,
  `update(uniqueId, patch)` (rename, re-URL), `move(uniqueId, newParentId, newPosition)`,
  `remove(uniqueId)` (cascades via FK; cache prunes the subtree).
- `getForProfile(profileId)` returns a flat array; the renderer builds the tree.
- Validation: `move` rejects cycles (walking `parentId` chain) and re-parenting
  across profiles; `create` requires `url` for bookmarks and forbids it for folders.
- Events: `changed` → pushes all profiles' flat lists to renderers over
  `bookmarks:on-changed` (whole-list refresh; bookmark counts are small,
  so no delta protocol).
- **Live-tab associations, mirroring `PinnedTabsController`:** in-memory
  `bookmarkId → spaceId → tabId` plus a reverse map; `associateTab` /
  `dissociateTab` / `onBrowserTabDestroyed` wired to the tabs controller's
  `tab-removed` event. Associated tabs are created **ephemeral** so they never
  appear in the sidebar tab list and are never persisted as tabs. Renderer
  payloads carry `associatedTabIdsBySpace` per bookmark, exactly like
  `PinnedTabData`; the renderer resolves active/sleeping state by looking the
  tab id up in the regular tabs data (ephemeral tabs are already serialized
  to the renderer).

## Tab sleeping for bookmark tabs

The maintenance loop in `TabsController` currently skips ephemeral tabs
entirely. Change: ephemeral tabs (bookmark AND pinned associations) now
participate in **sleep** — sleeping keeps the association alive and frees
~20–50MB per tab, waking transparently on click — while remaining excluded
from **archive** (archive destroys the tab; associations should not silently
vanish on a timer). The decision logic is extracted into a pure, unit-tested
helper (`decideTabMaintenance`) in `src/shared`.

## IPC surface (`flow.bookmarks`)

`src/shared/flow/interfaces/browser/bookmarks.ts` + `src/main/ipc/browser/bookmarks.ts`
+ preload bindings, following the pinned-tabs pattern:

- `getData()` (all profiles, flat lists with associations) / `onChanged(callback)`
- `click(uniqueId)` — pinned-tab semantics: activate the associated live tab
  for the current space (waking it if asleep), or create an ephemeral tab at
  the bookmark's URL and associate it
- `createFromTab(tabId, parentId?)` — bookmark the given tab: creates the
  node, marks the tab ephemeral (leaves the tab list), associates it. This
  is what the address-bar star and tab context menu use.
- `createFolder(profileId, title, parentId?)`, `rename(uniqueId, title)`,
  `move(uniqueId, parentId, position)`, `remove(uniqueId)` (destroys the
  subtree's associated ephemeral tabs so they don't leak)
- `closeTab(uniqueId)` — destroy the associated tab for the current space
  (the bookmark stays; this is the row's ✕ affordance)
- `showContextMenu(uniqueId)` — main-process menu

## Renderer

New components under `browser-sidebar/_components/bookmarks/`:

- `bookmarks-section.tsx` — mounts in `space-pages-carousel.tsx` between
  `<PinGrid>` and `<NewTabButton>`; reads `space.profileId`; collapsible
  section header ("Bookmarks") persisted to `localStorage` like sidebar width.
  When the profile has no bookmarks the section renders nothing (no header,
  no empty state) — the first bookmark is created via the address-bar star,
  after which the section appears.
- `bookmark-node.tsx` — one row: favicon (via the existing favicon pipeline) or
  folder chevron, truncated title, hover close/… affordances. Rows are 7 (h-7)
  high — denser than tab rows to read as "library, not tabs".
- Tree state: expanded-folder set in component state (persisted per profile to
  `localStorage`); flat list → tree built with a `useMemo` on `parentId`.
- A new `BookmarksProvider` (context) subscribes to `flow.bookmarks.onChanged`.

Row states (Dia-style): idle (no associated tab in current space — dimmed),
active (associated tab exists; highlighted when focused), sleeping (associated
tab is asleep — moon icon, matching the tab-list treatment). The ✕ affordance
on hover closes the live tab and returns the row to idle; it never deletes
the bookmark.

Interactions:

- Click → `flow.bookmarks.click(id)` (activate-or-create, waking if asleep);
  folders toggle expansion.
- Address-bar star (`BookmarkIcon`, next to the extension actions): bookmarks
  the focused tab via `createFromTab`; filled when the focused tab IS an
  associated bookmark tab.
- Tab context menu gains "Bookmark This Page" (same `createFromTab` path).
- Bookmark context menu (main-process `Menu`): Close Tab (when a live tab
  exists) / Rename / Copy URL / Delete; folders: New Folder Inside / Rename /
  Delete. Rename swaps the row to an inline input.
- Drag & drop with `@atlaskit/pragmatic-drag-and-drop` (already used for tabs
  and pinned tabs — no new library):
  - reorder among siblings (closest-edge indicator),
  - drop *onto* a folder row to move into it,
  - v1 does not support dragging tabs into the section or bookmarks out.

## Error handling

- Controller methods return `null`/`false` on invalid input (missing node,
  cycle, cross-profile move) and `debugPrint` the reason; IPC handlers pass
  that through — the renderer treats a falsy result as a no-op.
- DB write failures follow the pinned-tabs convention (throw → caught in IPC
  handler → `false` to renderer).

## Testing

- `tests/shared/` unit tests for the pure helpers in `src/shared/bookmarks.ts`
  (flat list → tree, cycle detection) and for `decideTabMaintenance`
  (ephemeral tabs sleep but never archive).
- Live verification via the run-puerta recipe: create via IPC, click →
  ephemeral associated tab opens and activates, row renders in the sidebar,
  closeTab returns the row to idle, folder delete destroys the subtree and
  its live tabs.

Known behavior change rider: pinned-tab associated tabs also become
sleep-eligible (same ephemeral rule). Intentional — same RAM argument — and
called out in the PR.

## Migration note

`drizzle-kit generate` produces migration `0004_*`; committed alongside the
schema change. No data backfill needed (new feature). SQLite requires
`foreign_keys=ON` for the cascade — already set in `db/index.ts`.
