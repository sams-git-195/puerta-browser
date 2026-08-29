import { describe, expect, it } from "vitest";
import { buildBookmarkTree, wouldCreateCycle } from "../../src/shared/bookmarks";
import type { BookmarkData } from "../../src/shared/types/bookmarks";

function node(overrides: Partial<BookmarkData>): BookmarkData {
  return {
    uniqueId: "id",
    profileId: "main",
    parentId: null,
    kind: "bookmark",
    title: "Title",
    url: "https://example.com",
    faviconUrl: null,
    position: 0,
    createdAt: 0,
    associatedTabIdsBySpace: {},
    ...overrides
  };
}

describe("buildBookmarkTree", () => {
  it("nests children under folders and sorts every level by position", () => {
    const flat = [
      node({ uniqueId: "b2", position: 1 }),
      node({ uniqueId: "f1", kind: "folder", url: null, position: 0 }),
      node({ uniqueId: "c2", parentId: "f1", position: 1 }),
      node({ uniqueId: "c1", parentId: "f1", position: 0 })
    ];
    const tree = buildBookmarkTree(flat);
    expect(tree.map((n) => n.uniqueId)).toEqual(["f1", "b2"]);
    expect(tree[0].children.map((n) => n.uniqueId)).toEqual(["c1", "c2"]);
  });

  it("lifts orphans (missing parent) to the top level", () => {
    const tree = buildBookmarkTree([node({ uniqueId: "x", parentId: "gone" })]);
    expect(tree.map((n) => n.uniqueId)).toEqual(["x"]);
  });

  it("does not nest under a non-folder parent", () => {
    const flat = [node({ uniqueId: "a" }), node({ uniqueId: "b", parentId: "a" })];
    const tree = buildBookmarkTree(flat);
    expect(tree).toHaveLength(2);
  });
});

describe("wouldCreateCycle", () => {
  const parents = new Map<string, string | null>([
    ["root", null],
    ["a", "root"],
    ["b", "a"]
  ]);

  it("rejects self-parenting", () => {
    expect(wouldCreateCycle(parents, "a", "a")).toBe(true);
  });

  it("rejects moving a node under its own descendant", () => {
    expect(wouldCreateCycle(parents, "root", "b")).toBe(true);
    expect(wouldCreateCycle(parents, "a", "b")).toBe(true);
  });

  it("allows legal moves", () => {
    expect(wouldCreateCycle(parents, "b", "root")).toBe(false);
    expect(wouldCreateCycle(parents, "b", null)).toBe(false);
  });

  it("terminates on corrupt cyclic data", () => {
    const corrupt = new Map<string, string | null>([
      ["x", "y"],
      ["y", "x"]
    ]);
    expect(wouldCreateCycle(corrupt, "z", "x")).toBe(false);
  });
});
