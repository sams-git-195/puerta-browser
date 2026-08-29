import { bookmarksController } from "@/controllers/bookmarks-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { BrowserWindow } from "@/controllers/windows-controller/types";
import { moveTabOrGroupToWindow } from "@/controllers/tabs-controller/tab-sync";
import { clipboard, ipcMain, Menu, MenuItem } from "electron";

// --- Change notification (mirrors pinned-tabs) ---

let changeTimeout: NodeJS.Timeout | null = null;

function scheduleBookmarksChange() {
  if (changeTimeout) clearTimeout(changeTimeout);
  changeTimeout = setTimeout(() => {
    changeTimeout = null;
    const allByProfile = bookmarksController.getAllByProfile();
    for (const window of browserWindowsController.getWindows()) {
      window.sendMessageToCoreWebContents("bookmarks:on-changed", allByProfile);
    }
  }, 80);
}

bookmarksController.on("changed", () => {
  scheduleBookmarksChange();
});

// When a browser tab is destroyed, clear any bookmark association pointing to it.
tabsController.on("tab-removed", (tab) => {
  bookmarksController.onBrowserTabDestroyed(tab.id);
});

// --- Shared helpers ---

function destroyTabs(tabIds: number[], keepTabId?: number | null) {
  for (const tabId of tabIds) {
    if (tabId === keepTabId) continue;
    const tab = tabsController.getTabById(tabId);
    if (tab && !tab.isDestroyed) {
      tab.destroy();
    }
  }
}

/**
 * Click semantics (mirrors pinned tabs): activate the associated live tab for
 * the current space — waking it if asleep happens automatically on show — or
 * create a new ephemeral tab at the bookmark's URL and associate it.
 */
async function handleBookmarkClick(window: BrowserWindow, bookmarkId: string): Promise<boolean> {
  const bookmark = bookmarksController.getById(bookmarkId);
  if (!bookmark || bookmark.kind !== "bookmark" || !bookmark.url) return false;

  const currentSpaceId = window.currentSpaceId;
  if (!currentSpaceId) return false;

  const associatedTabId = bookmarksController.getAssociatedTabId(bookmarkId, currentSpaceId);
  if (associatedTabId !== null) {
    const tab = tabsController.getTabById(associatedTabId);
    if (tab && !tab.isDestroyed) {
      if (tab.getWindow().id !== window.id) {
        await moveTabOrGroupToWindow(tab, window);
      }
      tabsController.activateTab(tab);
      return true;
    }
    // Stale association — clear it and fall through to create
    bookmarksController.dissociateTab(bookmarkId, currentSpaceId);
  }

  const newTab = await tabsController.createTab(window.id, bookmark.profileId, currentSpaceId, undefined, {
    url: bookmark.url,
    ephemeral: true
  });
  bookmarksController.associateTab(bookmarkId, currentSpaceId, newTab.id);
  tabsController.activateTab(newTab);
  return true;
}

// --- IPC Handlers ---

ipcMain.handle("bookmarks:get-data", async () => {
  return bookmarksController.getAllByProfile();
});

ipcMain.handle("bookmarks:click", async (event, bookmarkId: string) => {
  const window = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!window) return false;
  return handleBookmarkClick(window, bookmarkId);
});

/**
 * Bookmark an existing browser tab (address-bar star / tab context menu):
 * creates the node, marks the tab ephemeral (leaves the tab list), associates.
 * Exported for the tab context menu in ipc/browser/tabs.ts.
 */
export function bookmarkTabById(tabId: number, parentId?: string | null) {
  const tab = tabsController.getTabById(tabId);
  if (!tab || tab.isDestroyed || !tab.url) return null;

  // Already an associated bookmark tab? Nothing to do.
  if (bookmarksController.getBookmarkIdByTabId(tab.id)) return null;

  const bookmark = bookmarksController.create({
    profileId: tab.profileId,
    kind: "bookmark",
    title: tab.title || tab.url,
    url: tab.url,
    faviconUrl: tab.faviconURL ?? null,
    parentId: parentId ?? null
  });
  if (!bookmark) return null;

  tabsController.makeTabEphemeral(tab.id);
  bookmarksController.associateTab(bookmark.uniqueId, tab.spaceId, tab.id);
  return bookmarksController.getById(bookmark.uniqueId);
}

ipcMain.handle("bookmarks:create-from-tab", async (_event, tabId: number, parentId?: string | null) => {
  return bookmarkTabById(tabId, parentId);
});

ipcMain.handle(
  "bookmarks:create-folder",
  async (_event, profileId: string, title: string, parentId?: string | null) => {
    const folder = bookmarksController.create({
      profileId,
      kind: "folder",
      title: title || "New Folder",
      parentId: parentId ?? null
    });
    return folder ? bookmarksController.getById(folder.uniqueId) : null;
  }
);

ipcMain.handle("bookmarks:rename", async (_event, bookmarkId: string, title: string) => {
  return bookmarksController.rename(bookmarkId, title);
});

ipcMain.handle("bookmarks:move", async (_event, bookmarkId: string, parentId: string | null, position: number) => {
  return bookmarksController.move(bookmarkId, parentId, position);
});

/** Delete a bookmark/folder subtree, destroying its associated live tabs. */
ipcMain.handle("bookmarks:remove", async (_event, bookmarkId: string) => {
  destroyTabs(bookmarksController.remove(bookmarkId));
  return true;
});

/** Close the associated live tab for the current space; the bookmark stays. */
ipcMain.handle("bookmarks:close-tab", async (event, bookmarkId: string) => {
  const window = browserWindowsController.getWindowFromWebContents(event.sender);
  const currentSpaceId = window?.currentSpaceId;
  if (!currentSpaceId) return false;

  const tabId = bookmarksController.getAssociatedTabId(bookmarkId, currentSpaceId);
  if (tabId === null) return false;

  const tab = tabsController.getTabById(tabId);
  if (tab && !tab.isDestroyed) {
    tab.destroy(); // association clears via the tab-removed hook
    return true;
  }
  bookmarksController.dissociateTab(bookmarkId, currentSpaceId);
  return false;
});

ipcMain.on("bookmarks:show-context-menu", (event, bookmarkId: string) => {
  const window = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!window) return;

  const bookmark = bookmarksController.getById(bookmarkId);
  if (!bookmark) return;

  const contextMenu = new Menu();
  const isFolder = bookmark.kind === "folder";

  if (!isFolder) {
    const currentSpaceId = window.currentSpaceId;
    const associatedTabId = currentSpaceId ? bookmarksController.getAssociatedTabId(bookmarkId, currentSpaceId) : null;
    const liveTab = associatedTabId !== null ? tabsController.getTabById(associatedTabId) : undefined;

    contextMenu.append(
      new MenuItem({
        label: "Close Tab",
        enabled: !!liveTab && !liveTab.isDestroyed,
        click: () => {
          if (liveTab && !liveTab.isDestroyed) liveTab.destroy();
        }
      })
    );
    contextMenu.append(
      new MenuItem({
        label: "Copy URL",
        click: () => {
          if (bookmark.url) clipboard.writeText(bookmark.url);
        }
      })
    );
  } else {
    contextMenu.append(
      new MenuItem({
        label: "New Folder Inside",
        click: () => {
          bookmarksController.create({
            profileId: bookmark.profileId,
            kind: "folder",
            title: "New Folder",
            parentId: bookmarkId
          });
        }
      })
    );
  }

  contextMenu.append(new MenuItem({ type: "separator" }));
  contextMenu.append(
    new MenuItem({
      label: "Rename",
      click: () => {
        // The renderer swaps the row to an inline input
        for (const win of browserWindowsController.getWindows()) {
          win.sendMessageToCoreWebContents("bookmarks:on-rename-requested", bookmarkId);
        }
      }
    })
  );
  contextMenu.append(
    new MenuItem({
      label: isFolder ? "Delete Folder" : "Delete Bookmark",
      click: () => {
        destroyTabs(bookmarksController.remove(bookmarkId));
      }
    })
  );

  contextMenu.popup({ window: window.browserWindow });
});
