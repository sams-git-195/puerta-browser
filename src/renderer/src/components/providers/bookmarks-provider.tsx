import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BookmarkData } from "~/types/bookmarks";

interface BookmarksContextValue {
  /** All bookmark nodes (flat) grouped by profile ID */
  bookmarksByProfile: Record<string, BookmarkData[]>;
  /** Get the flat bookmark list for a profile */
  getBookmarks: (profileId: string) => BookmarkData[];
  /** Bookmark id with a pending context-menu Rename request (row shows an input) */
  renameRequestId: string | null;
  clearRenameRequest: () => void;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

const EMPTY_BOOKMARKS: BookmarkData[] = [];

export const useBookmarks = () => {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error("useBookmarks must be used within a BookmarksProvider");
  }
  return context;
};

interface BookmarksProviderProps {
  children: React.ReactNode;
}

export const BookmarksProvider = ({ children }: BookmarksProviderProps) => {
  const [bookmarksByProfile, setBookmarksByProfile] = useState<Record<string, BookmarkData[]>>({});
  const [renameRequestId, setRenameRequestId] = useState<string | null>(null);

  // Subscribe first, then fetch — closes the race window where a change
  // arrives between the initial fetch resolving and the listener registering.
  useEffect(() => {
    let settled = false;
    const unsubChanged = flow.bookmarks.onChanged((data) => {
      settled = true;
      setBookmarksByProfile(data);
    });
    const unsubRename = flow.bookmarks.onRenameRequested((bookmarkId) => {
      setRenameRequestId(bookmarkId);
    });
    flow.bookmarks.getData().then((data) => {
      if (!settled) {
        setBookmarksByProfile(data);
      }
    });
    return () => {
      unsubChanged();
      unsubRename();
    };
  }, []);

  const getBookmarks = useCallback(
    (profileId: string) => {
      return bookmarksByProfile[profileId] ?? EMPTY_BOOKMARKS;
    },
    [bookmarksByProfile]
  );

  const clearRenameRequest = useCallback(() => setRenameRequestId(null), []);

  const contextValue = useMemo(
    () => ({ bookmarksByProfile, getBookmarks, renameRequestId, clearRenameRequest }),
    [bookmarksByProfile, getBookmarks, renameRequestId, clearRenameRequest]
  );

  return <BookmarksContext.Provider value={contextValue}>{children}</BookmarksContext.Provider>;
};
