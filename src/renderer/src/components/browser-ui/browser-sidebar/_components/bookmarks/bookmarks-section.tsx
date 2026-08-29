import { cn, craftActiveFaviconURL } from "@/lib/utils";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRightIcon, FolderIcon, BookmarkIcon, MoonIcon, XIcon } from "lucide-react";
import { useBookmarks } from "@/components/providers/bookmarks-provider";
import { useTabs } from "@/components/providers/tabs-provider";
import { buildBookmarkTree, type BookmarkTreeNode } from "~/bookmarks";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachInstruction,
  extractInstruction,
  type Instruction
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";

const INDENT_PER_LEVEL = 12;
/** Sent as the position for "make-child" drops; the controller normalizes to the end. */
const END_POSITION = 1e9;

type DragData = { type: "bookmark-node"; id: string; profileId: string };

function isBookmarkDragData(data: Record<string | symbol, unknown>): data is DragData {
  return data.type === "bookmark-node";
}

// --- Row --- //

interface BookmarkRowProps {
  node: BookmarkTreeNode;
  depth: number;
  spaceId: string;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}

const BookmarkRow = memo(function BookmarkRow({ node, depth, spaceId, expanded, onToggleExpand }: BookmarkRowProps) {
  const { renameRequestId, clearRenameRequest } = useBookmarks();
  const { tabsData } = useTabs();
  const rowRef = useRef<HTMLDivElement>(null);
  const [instruction, setInstruction] = useState<Instruction["type"] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isFolder = node.kind === "folder";
  const associatedTabId = node.associatedTabIdsBySpace[spaceId];
  const liveTab = useMemo(
    () => (associatedTabId !== undefined ? (tabsData?.tabs.find((t) => t.id === associatedTabId) ?? null) : null),
    [associatedTabId, tabsData]
  );
  const isActive = !!liveTab;
  const isAsleep = !!liveTab?.asleep;
  const isFocused = !!liveTab && tabsData?.focusedTabIds[spaceId] === liveTab.id;

  const isRenaming = renameRequestId === node.uniqueId;

  // --- Drag & drop ---
  useEffect(() => {
    const element = rowRef.current;
    if (!element || isRenaming) return;

    const cleanupDraggable = draggable({
      element,
      getInitialData: (): DragData => ({ type: "bookmark-node", id: node.uniqueId, profileId: node.profileId }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false)
    });

    const cleanupDropTarget = dropTargetForElements({
      element,
      canDrop: ({ source }) => isBookmarkDragData(source.data) && source.data.id !== node.uniqueId,
      getData: ({ input, element: el }) =>
        attachInstruction(
          { nodeId: node.uniqueId },
          {
            element: el,
            input,
            currentLevel: depth,
            indentPerLevel: INDENT_PER_LEVEL,
            mode: isFolder && expanded ? "expanded" : "standard",
            // Only folders can receive children
            block: isFolder ? [] : ["make-child"]
          }
        ),
      onDrag: ({ self }) => setInstruction(extractInstruction(self.data)?.type ?? null),
      onDragLeave: () => setInstruction(null),
      onDrop: ({ self, source }) => {
        setInstruction(null);
        if (!isBookmarkDragData(source.data)) return;
        const draggedId = source.data.id;
        const dropInstruction = extractInstruction(self.data);
        if (!dropInstruction) return;

        // The controller validates cycles/cross-profile moves and normalizes
        // fractional positions.
        if (dropInstruction.type === "reorder-above") {
          flow.bookmarks.move(draggedId, node.parentId, node.position - 0.5);
        } else if (dropInstruction.type === "reorder-below") {
          flow.bookmarks.move(draggedId, node.parentId, node.position + 0.5);
        } else if (dropInstruction.type === "make-child") {
          flow.bookmarks.move(draggedId, node.uniqueId, END_POSITION);
        }
      }
    });

    return () => {
      cleanupDraggable();
      cleanupDropTarget();
    };
  }, [node.uniqueId, node.parentId, node.position, node.profileId, depth, isFolder, expanded, isRenaming]);

  // --- Handlers ---
  const handleClick = useCallback(() => {
    if (isRenaming) return;
    if (isFolder) {
      onToggleExpand(node.uniqueId);
    } else {
      flow.bookmarks.click(node.uniqueId);
    }
  }, [isFolder, isRenaming, node.uniqueId, onToggleExpand]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      flow.bookmarks.showContextMenu(node.uniqueId);
    },
    [node.uniqueId]
  );

  const handleCloseTab = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      flow.bookmarks.closeTab(node.uniqueId);
    },
    [node.uniqueId]
  );

  const submitRename = useCallback(
    (value: string) => {
      clearRenameRequest();
      const title = value.trim();
      if (title && title !== node.title) {
        flow.bookmarks.rename(node.uniqueId, title);
      }
    },
    [clearRenameRequest, node.title, node.uniqueId]
  );

  return (
    <div
      ref={rowRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      style={{ paddingLeft: depth * INDENT_PER_LEVEL }}
      className={cn(
        "group/bookmark relative h-7 w-full rounded-md min-w-0",
        "flex items-center gap-1.5 px-1.5 select-none cursor-default",
        "transition-[background-color]",
        !isFocused && "hover:bg-black/10 dark:hover:bg-white/10",
        isFocused && "bg-white/90 dark:bg-white/15",
        isDragging && "opacity-50",
        instruction === "make-child" && "bg-black/15 dark:bg-white/20"
      )}
    >
      {/* Reorder indicators */}
      {instruction === "reorder-above" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-full bg-black/60 dark:bg-white/70" />
      )}
      {instruction === "reorder-below" && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-black/60 dark:bg-white/70" />
      )}

      {/* Icon */}
      {isFolder ? (
        <>
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-black/50 dark:text-white/50 transition-transform",
              expanded && "rotate-90"
            )}
          />
          <FolderIcon className="size-3.5 shrink-0 text-black/60 dark:text-white/60" />
        </>
      ) : (
        <div className="size-3.5 shrink-0 ml-3">
          {liveTab || node.faviconUrl ? (
            <img
              src={liveTab ? craftActiveFaviconURL(liveTab.id, liveTab.faviconURL) : (node.faviconUrl ?? undefined)}
              alt=""
              className={cn("size-full rounded-sm object-contain", isAsleep && "grayscale")}
              style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
            />
          ) : (
            <BookmarkIcon className="size-full text-black/40 dark:text-white/40" />
          )}
        </div>
      )}

      {/* Title / rename input */}
      {isRenaming ? (
        <input
          autoFocus
          defaultValue={node.title}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename((e.target as HTMLInputElement).value);
            if (e.key === "Escape") clearRenameRequest();
          }}
          onBlur={(e) => submitRename(e.target.value)}
          className={cn(
            "min-w-0 flex-1 text-xs font-medium bg-transparent outline-none",
            "border-b border-black/30 dark:border-white/30 text-black/90 dark:text-white/90"
          )}
        />
      ) : (
        <span
          className={cn(
            "truncate min-w-0 flex-1 text-xs font-medium",
            isActive && !isAsleep ? "text-black/90 dark:text-white/90" : "text-black/60 dark:text-white/60"
          )}
        >
          {node.title}
        </span>
      )}

      {/* Sleeping indicator */}
      {isAsleep && (
        <div title="Tab is sleeping to save memory — click to wake" className="shrink-0">
          <MoonIcon className="size-3 text-black/40 dark:text-white/40" />
        </div>
      )}

      {/* Close live tab (bookmark stays) */}
      {isActive && !isRenaming && (
        <button
          onClick={handleCloseTab}
          onMouseDown={(e) => e.stopPropagation()}
          title="Close tab (keeps the bookmark)"
          className={cn(
            "size-4.5 shrink-0 rounded-sm p-0.5",
            "opacity-0 pointer-events-none group-hover/bookmark:opacity-100 group-hover/bookmark:pointer-events-auto",
            "hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
          )}
        >
          <XIcon className="size-3.5 text-black/60 dark:text-white/60" />
        </button>
      )}
    </div>
  );
});

// --- Tree --- //

function BookmarkTreeLevel({
  nodes,
  depth,
  spaceId,
  expandedIds,
  onToggleExpand
}: {
  nodes: BookmarkTreeNode[];
  depth: number;
  spaceId: string;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.uniqueId}>
          <BookmarkRow
            node={node}
            depth={depth}
            spaceId={spaceId}
            expanded={expandedIds.has(node.uniqueId)}
            onToggleExpand={onToggleExpand}
          />
          {node.kind === "folder" && expandedIds.has(node.uniqueId) && (
            <BookmarkTreeLevel
              nodes={node.children}
              depth={depth + 1}
              spaceId={spaceId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          )}
        </div>
      ))}
    </>
  );
}

// --- Section --- //

interface BookmarksSectionProps {
  profileId: string;
  spaceId: string;
}

export function BookmarksSection({ profileId, spaceId }: BookmarksSectionProps) {
  const { getBookmarks } = useBookmarks();
  const flat = getBookmarks(profileId);

  const expandedStorageKey = `BOOKMARKS_EXPANDED_${profileId}`;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(expandedStorageKey) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });

  const onToggleExpand = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        localStorage.setItem(expandedStorageKey, JSON.stringify([...next]));
        return next;
      });
    },
    [expandedStorageKey]
  );

  const tree = useMemo(() => buildBookmarkTree(flat), [flat]);

  // No bookmarks yet: render nothing — the first bookmark is created via the
  // address-bar star, after which the section appears.
  if (tree.length === 0) return null;

  return (
    <div className="shrink-0 flex flex-col gap-0.5 px-1 pb-1" data-component="bookmarks-section">
      <BookmarkTreeLevel
        nodes={tree}
        depth={0}
        spaceId={spaceId}
        expandedIds={expandedIds}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}
