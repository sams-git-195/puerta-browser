import type { BookmarkData } from "~/types/bookmarks";

export type BookmarkTreeNode = BookmarkData & {
  children: BookmarkTreeNode[];
};

/**
 * Builds the display tree from a flat bookmark list. Children are sorted by
 * position at every level. Nodes whose parentId doesn't resolve (deleted or
 * corrupt parent) are lifted to the top level instead of silently dropped.
 */
export function buildBookmarkTree(flat: BookmarkData[]): BookmarkTreeNode[] {
  const nodes = new Map<string, BookmarkTreeNode>();
  for (const item of flat) {
    nodes.set(item.uniqueId, { ...item, children: [] });
  }

  const roots: BookmarkTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId !== null ? nodes.get(node.parentId) : undefined;
    if (parent && parent.kind === "folder") {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortLevel = (level: BookmarkTreeNode[]) => {
    level.sort((a, b) => a.position - b.position);
    for (const node of level) {
      sortLevel(node.children);
    }
  };
  sortLevel(roots);
  return roots;
}

/**
 * Would re-parenting `nodeId` under `newParentId` create a cycle?
 * Walks the parent chain from newParentId; also treats self-parenting as a
 * cycle. Defensive against corrupt data: bails after visiting every node once.
 */
export function wouldCreateCycle(
  parentIdByNodeId: Map<string, string | null>,
  nodeId: string,
  newParentId: string | null
): boolean {
  if (newParentId === null) return false;
  if (newParentId === nodeId) return true;

  let current: string | null = newParentId;
  let steps = parentIdByNodeId.size + 1;
  while (current !== null && steps-- > 0) {
    if (current === nodeId) return true;
    current = parentIdByNodeId.get(current) ?? null;
  }
  return false;
}
