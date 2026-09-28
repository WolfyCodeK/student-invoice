import { describe, expect, it } from "vitest";
import { compareVersions, decideOnboarding, TOUR_VERSION, WHATS_NEW, type WhatsNewEntry } from "./whats-new";

const entry = (version: string): WhatsNewEntry => ({ version, items: [{ icon: "calendar-days", text: `In ${version}` }] });
/** Deliberately out of order: the result must still be oldest first. */
const CATALOGUE = [entry("1.2.0"), entry("1.1.0"), entry("1.1.1"), entry("2.0.0")];
const versions = (entries: WhatsNewEntry[]) => entries.map((e) => e.version);

describe("compareVersions", () => {
  it("orders by major, then minor, then patch, numerically", () => {
    expect(compareVersions("1.1.0", "1.1.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.1.0")).toBeLessThan(0);
    expect(compareVersions("1.1.0", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.1.2", "1.1.10")).toBeLessThan(0);
  });

  it("treats missing parts as 0 and ignores a leading v or a suffix", () => {
    expect(compareVersions("1.1", "1.1.0")).toBe(0);
    expect(compareVersions("v1.1.0", "1.1.0")).toBe(0);
    expect(compareVersions("1.1.0-beta.1", "1.1.0")).toBe(0);
    expect(compareVersions(" 1.1.0 ", "1.1.0")).toBe(0);
  });
});

describe("WHATS_NEW", () => {
  it("has one to five short lines per version, each with an icon", () => {
    expect(WHATS_NEW.find((e) => e.version === "1.1.0")?.items).toHaveLength(5);
    for (const entry of WHATS_NEW) {
      expect(entry.items.length).toBeGreaterThanOrEqual(1);
      expect(entry.items.length).toBeLessThanOrEqual(5);
      for (const item of entry.items) {
        expect(item.icon).toBeTruthy();
        expect(item.text.length).toBeLessThanOrEqual(70);
      }
    }
  });

  it("points 1.1.1 readers to where their previous wording goes", () => {
    const v111 = WHATS_NEW.find((e) => e.version === "1.1.1");
    expect(v111?.items.map((i) => i.text).join(" ")).toContain("Settings → Email wording");
  });

  it("lists each version once, and the tour's version has an entry", () => {
    const all = versions(WHATS_NEW);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain(TOUR_VERSION);
  });
});

describe("decideOnboarding", () => {
  describe("when this version has already been seen", () => {
    it("shows nothing and records nothing", () => {
      expect(decideOnboarding({ lastSeenVersion: "1.1.0", currentVersion: "1.1.0", hasData: true })).toEqual({
        whatsNew: [],
        tour: false,
        markSeen: false,
      });
    });

    it("treats 1.1 and 1.1.0 as the same version", () => {
      expect(decideOnboarding({ lastSeenVersion: "1.1", currentVersion: "1.1.0", hasData: true }).markSeen).toBe(false);
    });
  });

  describe("when no version was ever recorded", () => {
    it("updating from 1.0.x (there is data): shows What's new, then the tour", () => {
      const result = decideOnboarding({ currentVersion: "1.1.0", hasData: true });
      expect(versions(result.whatsNew)).toEqual(["1.1.0"]);
      expect(result.whatsNew[0].items).toHaveLength(5);
      expect(result.tour).toBe(true);
      expect(result.markSeen).toBe(true);
    });

    it("updating from 1.0.x straight to a later version: every entry up to now, oldest first, and the tour", () => {
      const result = decideOnboarding({ currentVersion: "1.2.0", hasData: true }, CATALOGUE);
      expect(versions(result.whatsNew)).toEqual(["1.1.0", "1.1.1", "1.2.0"]);
      expect(result.tour).toBe(true);
      expect(result.markSeen).toBe(true);
    });

    it("a fresh install (no data): shows nothing but records the version", () => {
      expect(decideOnboarding({ currentVersion: "1.1.0", hasData: false })).toEqual({
        whatsNew: [],
        tour: false,
        markSeen: true,
      });
    });

    it("treats an empty recorded version as none", () => {
      expect(decideOnboarding({ lastSeenVersion: "", currentVersion: "1.1.0", hasData: false }).whatsNew).toEqual([]);
      expect(decideOnboarding({ lastSeenVersion: "", currentVersion: "1.1.0", hasData: true }).tour).toBe(true);
    });

    it("no tour when this build is older than the tour's version", () => {
      const result = decideOnboarding({ currentVersion: "1.0.9", hasData: true }, CATALOGUE);
      expect(result.whatsNew).toEqual([]);
      expect(result.tour).toBe(false);
      expect(result.markSeen).toBe(true);
    });
  });

  describe("after an update", () => {
    it("shows only the entries after the last one seen, up to this version, oldest first", () => {
      const result = decideOnboarding({ lastSeenVersion: "1.1.0", currentVersion: "1.2.0", hasData: true }, CATALOGUE);
      expect(versions(result.whatsNew)).toEqual(["1.1.1", "1.2.0"]);
      expect(result.markSeen).toBe(true);
    });

    it("runs the tour when the update crosses the tour's version", () => {
      const result = decideOnboarding({ lastSeenVersion: "1.0.1", currentVersion: "1.1.0", hasData: true });
      expect(versions(result.whatsNew)).toEqual(["1.1.0"]);
      expect(result.tour).toBe(true);
      expect(result.markSeen).toBe(true);
    });

    it("runs the tour when skipping past the tour's version", () => {
      const result = decideOnboarding({ lastSeenVersion: "1.0.1", currentVersion: "2.0.0", hasData: false }, CATALOGUE);
      expect(versions(result.whatsNew)).toEqual(["1.1.0", "1.1.1", "1.2.0", "2.0.0"]);
      expect(result.tour).toBe(true);
    });

    it("later updates show What's new only, never the tour again", () => {
      const result = decideOnboarding({ lastSeenVersion: "1.1.0", currentVersion: "1.1.1", hasData: true }, CATALOGUE);
      expect(versions(result.whatsNew)).toEqual(["1.1.1"]);
      expect(result.tour).toBe(false);
      expect(result.markSeen).toBe(true);
    });

    it("an update with no entry of its own shows nothing but still records the version", () => {
      const result = decideOnboarding({ lastSeenVersion: "1.1.1", currentVersion: "1.1.5", hasData: true }, CATALOGUE);
      expect(result).toEqual({ whatsNew: [], tour: false, markSeen: true });
    });

    it("does not show entries newer than this version", () => {
      const result = decideOnboarding({ lastSeenVersion: "1.1.0", currentVersion: "1.1.1", hasData: true }, CATALOGUE);
      expect(versions(result.whatsNew)).not.toContain("1.2.0");
    });
  });

  describe("after a downgrade", () => {
    it("shows nothing and keeps the newer record", () => {
      expect(decideOnboarding({ lastSeenVersion: "1.2.0", currentVersion: "1.1.0", hasData: true }, CATALOGUE)).toEqual({
        whatsNew: [],
        tour: false,
        markSeen: false,
      });
    });
  });

  it("does not reorder or change the catalogue", () => {
    const catalogue = [...CATALOGUE];
    decideOnboarding({ currentVersion: "2.0.0", hasData: true }, catalogue);
    expect(catalogue).toEqual(CATALOGUE);
  });
});
