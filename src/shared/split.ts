export type SplitRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Horizontal gap between split columns, in pixels. */
export const SPLIT_GAP = 10;

/**
 * Calculates bounds for one tab in a split group: the page area is divided
 * into `count` equal-width columns (left to right, following the group's tab
 * order) separated by SPLIT_GAP. The last column absorbs rounding remainders
 * so the columns always tile the full page width.
 */
export function calculateSplitBounds(pageBounds: SplitRect, index: number, count: number): SplitRect {
  const safeCount = Math.max(1, count);
  const safeIndex = Math.min(Math.max(0, index), safeCount - 1);

  const totalGap = SPLIT_GAP * (safeCount - 1);
  const columnWidth = Math.floor((pageBounds.width - totalGap) / safeCount);
  const x = pageBounds.x + safeIndex * (columnWidth + SPLIT_GAP);

  const isLast = safeIndex === safeCount - 1;
  const width = isLast ? Math.max(0, pageBounds.x + pageBounds.width - x) : Math.max(0, columnWidth);

  return {
    x,
    y: pageBounds.y,
    width,
    height: pageBounds.height
  };
}
