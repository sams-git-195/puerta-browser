import { describe, expect, it } from "vitest";
import { BasicSettings, SleepTabValueMap, ArchiveTabValueMap } from "../../src/main/modules/basic-settings";

function getEnumSetting(id: string) {
  const setting = BasicSettings.find((s) => s.id === id);
  if (!setting || setting.type !== "enum") throw new Error(`enum setting ${id} not found`);
  return setting;
}

describe("sleepTabAfter setting", () => {
  const setting = getEnumSetting("sleepTabAfter");

  it("defaults to 1 hour", () => {
    expect(setting.defaultValue).toBe("1h");
  });

  it("has a value-map entry for every option", () => {
    for (const option of setting.options) {
      expect(SleepTabValueMap, `missing map entry for option "${option.id}"`).toHaveProperty(option.id);
    }
  });

  it("offers the expected durations including 12 hours and never", () => {
    const ids = setting.options.map((o) => o.id);
    for (const expected of ["30m", "1h", "2h", "12h", "never"]) {
      expect(ids).toContain(expected);
    }
  });

  it("uses a valid option as the default", () => {
    expect(setting.options.map((o) => o.id)).toContain(setting.defaultValue);
  });
});

describe("archiveTabAfter setting", () => {
  const setting = getEnumSetting("archiveTabAfter");

  it("has a value-map entry for every option", () => {
    for (const option of setting.options) {
      expect(ArchiveTabValueMap, `missing map entry for option "${option.id}"`).toHaveProperty(option.id);
    }
  });
});
