import { getDb, schema } from "@/saving/db";
import { generateID, getCurrentTimestamp } from "@/modules/utils";
import { debugPrint } from "@/modules/output";
import { eq } from "drizzle-orm";
import { wouldCreateCycle } from "~/bookmarks";
import { BookmarkData, PersistedBookmarkData } from "~/types/bookmarks";
import { TypedEventEmitter } from "@/modules/typed-event-emitter";

type BookmarksControllerEvents = {
  changed: [];
};

/**
 * Manages persistence and runtime state of bookmarks.
 *
 * Bookmarks are a profile-scoped tree (folders + bookmarks in one table,
 * discriminated by `kind`). A bookmark behaves like a pinned tab: at runtime
 * it can be associated with one live ephemeral browser tab per space; the
 * association machinery mirrors PinnedTabsController.
 *
 * All database writes are immediate (bookmarks change infrequently).
 */
class BookmarksController extends TypedEventEmitter<BookmarksControllerEvents> {
  /** In-memory cache of all bookmark nodes, keyed by uniqueId */
  private nodes = new Map<string, PersistedBookmarkData>();

  /** Runtime associations: bookmarkId → spaceId → browser tab ID */
  private associations = new Map<string, Map<string, number>>();

  /** Reverse lookup: browser tab ID → { bookmarkId, spaceId } */
  private reverseAssociations = new Map<number, { bookmarkId: string; spaceId: string }>();

  // --- Initialization ---

  loadAll(): void {
    const db = getDb();
    const rows = db.select().from(schema.bookmarks).all();
    this.nodes.clear();
    for (const row of rows) {
      this.nodes.set(row.uniqueId, { ...row, kind: row.kind });
    }
  }

  // --- CRUD ---

  /**
   * Create a bookmark or folder. Bookmarks require a url; folders must not
   * have one. Position defaults to the end of the target sibling list.
   */
  create(input: {
    profileId: string;
    kind: "bookmark" | "folder";
    title: string;
    url?: string | null;
    faviconUrl?: string | null;
    parentId?: string | null;
    position?: number;
  }): PersistedBookmarkData | null {
    const { profileId, kind, title } = input;
    const url = input.url ?? null;
    const parentId = input.parentId ?? null;

    if (kind === "bookmark" && !url) {
      debugPrint("BOOKMARKS", "create rejected: bookmark without url");
      return null;
    }
    if (kind === "folder" && url) {
      debugPrint("BOOKMARKS", "create rejected: folder with url");
      return null;
    }
    if (parentId !== null) {
      const parent = this.nodes.get(parentId);
      if (!parent || parent.kind !== "folder" || parent.profileId !== profileId) {
        debugPrint("BOOKMARKS", "create rejected: invalid parent", parentId);
        return null;
      }
    }

    const data: PersistedBookmarkData = {
      uniqueId: generateID(),
      profileId,
      parentId,
      kind,
      title,
      url,
      faviconUrl: input.faviconUrl ?? null,
      position: input.position ?? this.nextSiblingPosition(profileId, parentId),
      createdAt: getCurrentTimestamp()
    };

    const db = getDb();
    db.transaction((tx) => {
      tx.insert(schema.bookmarks)
        .values({ ...data })
        .run();
      this.nodes.set(data.uniqueId, data);
      this.normalizeSiblingPositionsInTx(tx, profileId, parentId);
    });

    this.emit("changed");
    return data;
  }

  rename(uniqueId: string, title: string): boolean {
    const data = this.nodes.get(uniqueId);
    if (!data || !title.trim()) return false;

    data.title = title.trim();
    getDb().update(schema.bookmarks).set({ title: data.title }).where(eq(schema.bookmarks.uniqueId, uniqueId)).run();
    this.emit("changed");
    return true;
  }

  updateFavicon(uniqueId: string, faviconUrl: string | null): void {
    const data = this.nodes.get(uniqueId);
    if (!data || data.kind !== "bookmark") return;

    data.faviconUrl = faviconUrl;
    getDb().update(schema.bookmarks).set({ faviconUrl }).where(eq(schema.bookmarks.uniqueId, uniqueId)).run();
    this.emit("changed");
  }

  /**
   * Move a node to a new parent and/or position. Rejects cycles,
   * cross-profile moves, and non-folder parents.
   */
  move(uniqueId: string, newParentId: string | null, newPosition: number): boolean {
    const data = this.nodes.get(uniqueId);
    if (!data) return false;

    if (newParentId !== null) {
      const parent = this.nodes.get(newParentId);
      if (!parent || parent.kind !== "folder" || parent.profileId !== data.profileId) {
        debugPrint("BOOKMARKS", "move rejected: invalid parent", newParentId);
        return false;
      }
    }

    const parentIdByNodeId = new Map<string, string | null>();
    for (const node of this.nodes.values()) {
      parentIdByNodeId.set(node.uniqueId, node.parentId);
    }
    if (wouldCreateCycle(parentIdByNodeId, uniqueId, newParentId)) {
      debugPrint("BOOKMARKS", "move rejected: would create cycle", uniqueId, "→", newParentId);
      return false;
    }

    const oldParentId = data.parentId;
    data.parentId = newParentId;
    data.position = newPosition;

    const db = getDb();
    db.transaction((tx) => {
      tx.update(schema.bookmarks)
        .set({ parentId: newParentId, position: newPosition })
        .where(eq(schema.bookmarks.uniqueId, uniqueId))
        .run();
      this.normalizeSiblingPositionsInTx(tx, data.profileId, newParentId);
      if (oldParentId !== newParentId) {
        this.normalizeSiblingPositionsInTx(tx, data.profileId, oldParentId);
      }
    });

    this.emit("changed");
    return true;
  }

  /**
   * Remove a node (and, for folders, its whole subtree via the cascading FK).
   * Returns the associated browser tab IDs cleared during removal so the
   * caller can destroy those live tabs.
   */
  remove(uniqueId: string): number[] {
    const data = this.nodes.get(uniqueId);
    if (!data) return [];

    const subtreeIds = this.collectSubtreeIds(uniqueId);

    const clearedTabIds: number[] = [];
    for (const nodeId of subtreeIds) {
      const spaceAssociations = this.associations.get(nodeId);
      if (spaceAssociations) {
        for (const tabId of spaceAssociations.values()) {
          clearedTabIds.push(tabId);
          this.reverseAssociations.delete(tabId);
        }
        this.associations.delete(nodeId);
      }
    }

    const db = getDb();
    db.transaction((tx) => {
      // The FK cascade removes the subtree rows in one statement
      tx.delete(schema.bookmarks).where(eq(schema.bookmarks.uniqueId, uniqueId)).run();
      for (const nodeId of subtreeIds) {
        this.nodes.delete(nodeId);
      }
      this.normalizeSiblingPositionsInTx(tx, data.profileId, data.parentId);
    });

    this.emit("changed");
    return clearedTabIds;
  }

  // --- Association management (mirrors PinnedTabsController) ---

  associateTab(bookmarkId: string, spaceId: string, tabId: number): void {
    let spaceAssociations = this.associations.get(bookmarkId);
    if (!spaceAssociations) {
      spaceAssociations = new Map<string, number>();
      this.associations.set(bookmarkId, spaceAssociations);
    }

    const oldTabId = spaceAssociations.get(spaceId);
    if (oldTabId !== undefined && oldTabId !== tabId) {
      this.reverseAssociations.delete(oldTabId);
    }

    const oldAssociation = this.reverseAssociations.get(tabId);
    if (oldAssociation !== undefined) {
      this.associations.get(oldAssociation.bookmarkId)?.delete(oldAssociation.spaceId);
    }

    spaceAssociations.set(spaceId, tabId);
    this.reverseAssociations.set(tabId, { bookmarkId, spaceId });
    this.emit("changed");
  }

  dissociateTab(bookmarkId: string, spaceId: string): void {
    const spaceAssociations = this.associations.get(bookmarkId);
    const tabId = spaceAssociations?.get(spaceId);
    if (spaceAssociations && tabId !== undefined) {
      this.reverseAssociations.delete(tabId);
      spaceAssociations.delete(spaceId);
      this.emit("changed");
    }
  }

  onBrowserTabDestroyed(tabId: number): void {
    const association = this.reverseAssociations.get(tabId);
    if (association !== undefined) {
      this.associations.get(association.bookmarkId)?.delete(association.spaceId);
      this.reverseAssociations.delete(tabId);
      this.emit("changed");
    }
  }

  // --- Queries ---

  getById(uniqueId: string): BookmarkData | null {
    const data = this.nodes.get(uniqueId);
    if (!data) return null;
    return { ...data, associatedTabIdsBySpace: this.getAssociatedTabIdsBySpace(uniqueId) };
  }

  /** All nodes grouped by profile, flat (the renderer builds the tree). */
  getAllByProfile(): Record<string, BookmarkData[]> {
    const result: Record<string, BookmarkData[]> = {};
    for (const data of this.nodes.values()) {
      (result[data.profileId] ??= []).push({
        ...data,
        associatedTabIdsBySpace: this.getAssociatedTabIdsBySpace(data.uniqueId)
      });
    }
    return result;
  }

  getAssociatedTabId(bookmarkId: string, spaceId: string): number | null {
    return this.associations.get(bookmarkId)?.get(spaceId) ?? null;
  }

  getBookmarkIdByTabId(tabId: number): { bookmarkId: string; spaceId: string } | null {
    return this.reverseAssociations.get(tabId) ?? null;
  }

  // --- Internal helpers ---

  private getAssociatedTabIdsBySpace(bookmarkId: string): Record<string, number> {
    const spaceAssociations = this.associations.get(bookmarkId);
    if (!spaceAssociations) return {};
    return Object.fromEntries(spaceAssociations);
  }

  private nextSiblingPosition(profileId: string, parentId: string | null): number {
    let maxPosition = -1;
    for (const node of this.nodes.values()) {
      if (node.profileId === profileId && node.parentId === parentId && node.position > maxPosition) {
        maxPosition = node.position;
      }
    }
    return maxPosition + 1;
  }

  /** Depth-first subtree ids, defensive against corrupt parent cycles. */
  private collectSubtreeIds(rootId: string): string[] {
    const childrenByParent = new Map<string, string[]>();
    for (const node of this.nodes.values()) {
      if (node.parentId !== null) {
        let siblings = childrenByParent.get(node.parentId);
        if (!siblings) {
          siblings = [];
          childrenByParent.set(node.parentId, siblings);
        }
        siblings.push(node.uniqueId);
      }
    }

    const result: string[] = [];
    const seen = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
      for (const childId of childrenByParent.get(id) ?? []) {
        stack.push(childId);
      }
    }
    return result;
  }

  /** Renumber siblings of (profileId, parentId) to contiguous 0, 1, 2, ... */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeSiblingPositionsInTx(tx: any, profileId: string, parentId: string | null): void {
    const siblings: PersistedBookmarkData[] = [];
    for (const node of this.nodes.values()) {
      if (node.profileId === profileId && node.parentId === parentId) {
        siblings.push(node);
      }
    }
    siblings.sort((a, b) => a.position - b.position);

    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].position !== i) {
        siblings[i].position = i;
        tx.update(schema.bookmarks)
          .set({ position: i })
          .where(eq(schema.bookmarks.uniqueId, siblings[i].uniqueId))
          .run();
      }
    }
  }
}

// Singleton instance
export const bookmarksController = new BookmarksController();
