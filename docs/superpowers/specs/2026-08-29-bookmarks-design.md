# Bookmarks — Design Spec

Date: 2026-08-29
Status: awaiting review
Branch: `feat/bookmarks`

## Goal

A bookmarks ("favourites") system in the Zen/Arc mold: a compact tree of
saved pages in the sidebar, rendered **below the pinned-tab grid and above
the tab list**, with folders and plain bookmarks freely mixed. Profile-scoped
(decided): one bookmark tree per profile, visible in every space of that
profile.

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
- Events: `changed(profileId)` → pushes the profile's flat list to renderers
  over `bookmarks:on-changed` (whole-list refresh; bookmark counts are small,
  so no delta protocol).

## IPC surface (`flow.bookmarks`)

`src/shared/flow/interfaces/browser/bookmarks.ts` + `src/main/ipc/browser/bookmarks.ts`
+ preload bindings, following the pinned-tabs pattern:

- `getAll(profileId)` / `onChanged(callback)`
- `create(input)`, `update(uniqueId, patch)`, `move(uniqueId, parentId, position)`, `remove(uniqueId)`
- `open(uniqueId, disposition: "current" | "new-tab" | "glance")` — "current"
  navigates the focused tab (or opens one), "new-tab" opens a background tab;
  "glance" opens the bookmark as a glance popup over the current tab when
  glance is enabled, else falls back to a foreground new tab.

Adding the current page: the address-bar area gets a bookmark toggle
(star/`BookmarkIcon`) that creates/removes a bookmark for the focused tab's
URL at the top level, and the sidebar section header gets "add current page" +
"new folder" buttons.

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

Interactions:

- Click → `open(uniqueId, "current")`; middle-click → `"new-tab"`;
  Shift+click → `"glance"`.
- Context menu (main-process `Menu`, like tabs): Open / Open in New Tab /
  Open in Glance / Rename / Delete; folders: New Bookmark Here / New Folder /
  Rename / Delete.
- Rename inline: the row swaps to an input on context-menu Rename (matches
  space rename UX elsewhere in settings).
- Drag & drop with `@atlaskit/pragmatic-drag-and-drop` (already used for tabs
  and pinned tabs — no new library):
  - reorder among siblings (closest-edge indicator),
  - drop *onto* a folder row to move into it,
  - drag a **tab** from the tab list onto the bookmarks section to bookmark it,
  - v1 does not support dragging bookmarks out to the tab list.

## Error handling

- Controller methods return `null`/`false` on invalid input (missing node,
  cycle, cross-profile move) and `debugPrint` the reason; IPC handlers pass
  that through — the renderer treats a falsy result as a no-op.
- DB write failures follow the pinned-tabs convention (throw → caught in IPC
  handler → `false` to renderer).

## Testing

- `tests/shared/` unit tests for the pure tree helpers (flat list → tree,
  cycle detection, sibling position normalization) — these live in
  `src/shared/bookmarks.ts` so both processes and tests can import them.
- Live verification via the existing Playwright driver recipe: create via IPC,
  assert `getAll` shape, check sidebar DOM rows, open → tab navigates,
  delete folder → subtree gone from DB.

## Migration note

`drizzle-kit generate` produces migration `0004_*`; committed alongside the
schema change. No data backfill needed (new feature). SQLite requires
`foreign_keys=ON` for the cascade — already set in `db/index.ts`.
