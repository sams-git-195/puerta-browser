export type GlanceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Size ratios for the two stacked views in a glance group. The front (popup)
// tab is smaller than the back (source) tab so the back tab peeks out around
// the edges, giving the "preview over the page" look. The renderer's glance
// controls mirror FRONT ratios in CSS to position chrome over the front tab —
// keep them in sync via these exports.
export const GLANCE_FRONT_WIDTH_RATIO = 0.85;
export const GLANCE_FRONT_HEIGHT_RATIO = 1;
export const GLANCE_BACK_WIDTH_RATIO = 0.95;
export const GLANCE_BACK_HEIGHT_RATIO = 0.975;

/**
 * Calculates bounds for a tab in glance mode, centered within pageBounds.
 * Front tab is slightly smaller; back tab is larger but rendered behind.
 */
export function calculateGlanceBounds(pageBounds: GlanceRect, isFront: boolean): GlanceRect {
  const widthPercentage = isFront ? GLANCE_FRONT_WIDTH_RATIO : GLANCE_BACK_WIDTH_RATIO;
  const heightPercentage = isFront ? GLANCE_FRONT_HEIGHT_RATIO : GLANCE_BACK_HEIGHT_RATIO;

  const newWidth = Math.floor(pageBounds.width * widthPercentage);
  const newHeight = Math.floor(pageBounds.height * heightPercentage);

  const xOffset = Math.floor((pageBounds.width - newWidth) / 2);
  const yOffset = Math.floor((pageBounds.height - newHeight) / 2);

  return {
    x: pageBounds.x + xOffset,
    y: pageBounds.y + yOffset,
    width: newWidth,
    height: newHeight
  };
}
