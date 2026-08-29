export type TabMaintenanceAction = "archive" | "sleep" | null;

export type TabMaintenanceInput = {
  visible: boolean;
  asleep: boolean;
  /** true for bookmark/pinned-tab associated tabs hidden from the tab list */
  ephemeral: boolean;
  /** unix seconds */
  lastActiveAt: number;
};

export type TabMaintenanceThresholds = {
  /** seconds of inactivity before archiving (Infinity = never) */
  archiveAfterSeconds: number;
  /** seconds of inactivity before sleeping (Infinity = never) */
  sleepAfterSeconds: number;
};

/**
 * Decides what the periodic maintenance loop should do with a background tab.
 *
 * Ephemeral tabs (bookmark and pinned-tab associations) participate in SLEEP —
 * sleeping keeps the association alive and frees the renderer process — but
 * never in ARCHIVE, which destroys the tab: associations should not silently
 * vanish on a timer.
 */
export function decideTabMaintenance(
  tab: TabMaintenanceInput,
  thresholds: TabMaintenanceThresholds,
  nowSeconds: number
): TabMaintenanceAction {
  if (tab.visible) return null;

  const inactiveFor = nowSeconds - tab.lastActiveAt;

  if (!tab.ephemeral && inactiveFor >= thresholds.archiveAfterSeconds) {
    return "archive";
  }
  if (!tab.asleep && inactiveFor >= thresholds.sleepAfterSeconds) {
    return "sleep";
  }
  return null;
}
