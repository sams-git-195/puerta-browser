import { IPCListener } from "~/flow/types";
import { BookmarkData } from "~/types/bookmarks";

// API //
export interface FlowBookmarksAPI {
  /**
   * Get all bookmark nodes (flat) grouped by profile ID.
   * The renderer builds the tree via ~/bookmarks buildBookmarkTree.
   */
  getData: () => Promise<Record<string, BookmarkData[]>>;

  /**
   * Listen for changes to bookmarks data.
   * @param callback Receives all bookmark nodes grouped by profile ID
   */
  onChanged: IPCListener<[Record<string, BookmarkData[]>]>;

  /**
   * Listen for a context-menu Rename request (the row swaps to an inline input).
   * @param callback Receives the bookmark's unique ID
   */
  onRenameRequested: IPCListener<[string]>;

  /**
   * Click handler (pinned-tab semantics): activate the associated live tab
   * for the current space, or create an ephemeral tab at the bookmark's URL.
   * @param bookmarkId The unique ID of the bookmark
   */
  click: (bookmarkId: string) => Promise<boolean>;

  /**
   * Bookmark an existing browser tab: creates the node, marks the tab
   * ephemeral (it leaves the tab list), and associates it.
   * @param tabId The ID of the browser tab to bookmark
   * @param parentId Optional folder to create the bookmark in
   */
  createFromTab: (tabId: number, parentId?: string | null) => Promise<BookmarkData | null>;

  /**
   * Create a folder.
   * @param profileId The profile the folder belongs to
   * @param title The folder title
   * @param parentId Optional parent folder
   */
  createFolder: (profileId: string, title: string, parentId?: string | null) => Promise<BookmarkData | null>;

  /**
   * Rename a bookmark or folder.
   */
  rename: (bookmarkId: string, title: string) => Promise<boolean>;

  /**
   * Move a node to a new parent/position. Rejects cycles.
   */
  move: (bookmarkId: string, parentId: string | null, position: number) => Promise<boolean>;

  /**
   * Delete a bookmark or folder subtree (destroys associated live tabs).
   */
  remove: (bookmarkId: string) => Promise<boolean>;

  /**
   * Close the associated live tab for the current space; the bookmark stays.
   */
  closeTab: (bookmarkId: string) => Promise<boolean>;

  /**
   * Show the context menu for a bookmark or folder.
   */
  showContextMenu: (bookmarkId: string) => void;
}
