import { cn } from "@/lib/utils";
import { BookmarkIcon } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { useFocusedTabId } from "@/components/providers/tabs-provider";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useBookmarks } from "@/components/providers/bookmarks-provider";

/**
 * Address-bar star: bookmarks the focused tab (Dia-style — the tab leaves the
 * tab list and becomes the bookmark's live tab). Filled when the focused tab
 * already IS an associated bookmark tab.
 */
export const BookmarkStar = memo(function BookmarkStar() {
  const focusedTabId = useFocusedTabId();
  const { currentSpace } = useSpaces();
  const { getBookmarks } = useBookmarks();

  const bookmarks = getBookmarks(currentSpace?.profileId ?? "");
  const isBookmarked = useMemo(() => {
    if (focusedTabId === null || !currentSpace) return false;
    return bookmarks.some((node) => node.associatedTabIdsBySpace[currentSpace.id] === focusedTabId);
  }, [bookmarks, currentSpace, focusedTabId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Keep the omnibox from opening (the whole address bar is clickable)
      e.stopPropagation();
      if (focusedTabId === null || isBookmarked) return;
      flow.bookmarks.createFromTab(focusedTabId);
    },
    [focusedTabId, isBookmarked]
  );

  if (focusedTabId === null) return null;

  return (
    <button
      onClick={handleClick}
      title={isBookmarked ? "This page is bookmarked" : "Bookmark this page"}
      data-component="bookmark-star"
      className={cn(
        "size-6 flex items-center justify-center rounded-md shrink-0",
        "hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      )}
    >
      <BookmarkIcon
        className={cn(
          "size-3.5",
          isBookmarked ? "text-black/80 dark:text-white/90 fill-current" : "text-black/50 dark:text-white/50"
        )}
      />
    </button>
  );
});
