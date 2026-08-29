import { describe, expect, it } from "vitest";
import { calculateSplitBounds, SPLIT_GAP } from "../../src/shared/split";

const pageBounds = { x: 100, y: 50, width: 1001, height: 800 };

describe("calculateSplitBounds", () => {
  it("gives a single tab the full page bounds", () => {
    expect(calculateSplitBounds(pageBounds, 0, 1)).toEqual(pageBounds);
  });

  it("splits two tabs into equal columns with a gap", () => {
    const left = calculateSplitBounds(pageBounds, 0, 2);
    const right = calculateSplitBounds(pageBounds, 1, 2);

    expect(left.x).toBe(100);
    expect(right.x).toBe(left.x + left.width + SPLIT_GAP);
    // Last column absorbs the rounding remainder and ends at the page edge
    expect(right.x + right.width).toBe(pageBounds.x + pageBounds.width);
    expect(right.width - left.width).toBeLessThanOrEqual(1);
    for (const b of [left, right]) {
      expect(b.y).toBe(50);
      expect(b.height).toBe(800);
    }
  });

  it("tiles three columns without overlap and covers the full width", () => {
    const cols = [0, 1, 2].map((i) => calculateSplitBounds(pageBounds, i, 3));
    expect(cols[1].x).toBe(cols[0].x + cols[0].width + SPLIT_GAP);
    expect(cols[2].x).toBe(cols[1].x + cols[1].width + SPLIT_GAP);
    expect(cols[2].x + cols[2].width).toBe(pageBounds.x + pageBounds.width);
  });

  it("clamps out-of-range indexes and counts", () => {
    expect(calculateSplitBounds(pageBounds, 5, 2)).toEqual(calculateSplitBounds(pageBounds, 1, 2));
    expect(calculateSplitBounds(pageBounds, -1, 2)).toEqual(calculateSplitBounds(pageBounds, 0, 2));
    expect(calculateSplitBounds(pageBounds, 0, 0)).toEqual(pageBounds);
  });

  it("never produces negative sizes on tiny bounds", () => {
    const b = calculateSplitBounds({ x: 0, y: 0, width: 4, height: 4 }, 0, 3);
    expect(b.width).toBeGreaterThanOrEqual(0);
  });
});
