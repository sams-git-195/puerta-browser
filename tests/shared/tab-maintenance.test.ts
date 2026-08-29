import { describe, expect, it } from "vitest";
import { decideTabMaintenance } from "../../src/shared/tab-maintenance";

const thresholds = { archiveAfterSeconds: 12 * 3600, sleepAfterSeconds: 3600 };
const base = { visible: false, asleep: false, ephemeral: false, lastActiveAt: 0 };

describe("decideTabMaintenance", () => {
  it("never touches visible tabs", () => {
    expect(decideTabMaintenance({ ...base, visible: true }, thresholds, 999999)).toBeNull();
  });

  it("sleeps a stale background tab", () => {
    expect(decideTabMaintenance(base, thresholds, 3600)).toBe("sleep");
  });

  it("does not re-sleep an already sleeping tab", () => {
    expect(decideTabMaintenance({ ...base, asleep: true }, thresholds, 3600)).toBeNull();
  });

  it("archives a very stale normal tab", () => {
    expect(decideTabMaintenance(base, thresholds, 12 * 3600)).toBe("archive");
  });

  it("sleeps ephemeral (bookmark/pinned) tabs but never archives them", () => {
    expect(decideTabMaintenance({ ...base, ephemeral: true }, thresholds, 3600)).toBe("sleep");
    expect(decideTabMaintenance({ ...base, ephemeral: true }, thresholds, 100 * 3600)).toBe("sleep");
    expect(decideTabMaintenance({ ...base, ephemeral: true, asleep: true }, thresholds, 100 * 3600)).toBeNull();
  });

  it("does nothing before either threshold", () => {
    expect(decideTabMaintenance(base, thresholds, 100)).toBeNull();
  });

  it("respects 'never' (Infinity) thresholds", () => {
    const never = { archiveAfterSeconds: Infinity, sleepAfterSeconds: Infinity };
    expect(decideTabMaintenance(base, never, 1e12)).toBeNull();
  });
});
