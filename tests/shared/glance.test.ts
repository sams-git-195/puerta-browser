import { describe, expect, it } from "vitest";
import { calculateGlanceBounds, GLANCE_FRONT_WIDTH_RATIO, GLANCE_BACK_WIDTH_RATIO } from "../../src/shared/glance";

const pageBounds = { x: 100, y: 50, width: 1000, height: 800 };

describe("calculateGlanceBounds", () => {
  it("centers the front tab at the front ratios", () => {
    const bounds = calculateGlanceBounds(pageBounds, true);
    expect(bounds.width).toBe(Math.floor(1000 * GLANCE_FRONT_WIDTH_RATIO));
    expect(bounds.height).toBe(800); // front height ratio is 1
    // Centered horizontally within pageBounds
    expect(bounds.x).toBe(100 + Math.floor((1000 - bounds.width) / 2));
    expect(bounds.y).toBe(50);
  });

  it("makes the back tab larger than the front tab", () => {
    const front = calculateGlanceBounds(pageBounds, true);
    const back = calculateGlanceBounds(pageBounds, false);
    expect(back.width).toBe(Math.floor(1000 * GLANCE_BACK_WIDTH_RATIO));
    expect(back.width).toBeGreaterThan(front.width);
    expect(back.height).toBeLessThanOrEqual(800);
  });

  it("never produces negative sizes on tiny bounds", () => {
    const bounds = calculateGlanceBounds({ x: 0, y: 0, width: 1, height: 1 }, true);
    expect(bounds.width).toBeGreaterThanOrEqual(0);
    expect(bounds.height).toBeGreaterThanOrEqual(0);
  });
});
