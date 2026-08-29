/**
 * Bookmark data that is persisted to disk.
 * Bookmarks are a profile-scoped tree of saved pages (Dia-style): folders and
 * bookmarks share one table/row shape, discriminated by `kind`. A bookmark
 * behaves like a pinned tab — it is associated with a live (ephemeral)
 * browser tab per space at runtime rather than opening entries in the tab list.
 */
export type BookmarkKind = "bookmark" | "folder";

export type PersistedBookmarkData = {
  uniqueId: string;
  profileId: string;
  /** null = top level */
  parentId: string | null;
  kind: BookmarkKind;
  title: string;
  /** null for folders */
  url: string | null;
  /** null for folders */
  faviconUrl: string | null;
  /** ordering among siblings */
  position: number;
  /** unix seconds */
  createdAt: number;
};

/**
 * Bookmark data sent to the renderer process.
 * Extends persisted data with runtime association info (mirrors PinnedTabData).
 */
export type BookmarkData = PersistedBookmarkData & {
  /** Runtime-only: map of spaceId -> associated live tab ID. Empty for folders. */
  associatedTabIdsBySpace: Record<string, number>;
};
