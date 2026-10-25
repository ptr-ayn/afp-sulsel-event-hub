import { describe, expect, it } from "vitest";
import { fmtDate, hasDateConflict, inclusiveDateRange } from "@/lib/format";

describe("fmtDate", () => {
  it("formats date-only values in the Asia/Makassar timezone", () => {
    expect(fmtDate("2026-01-01")).toContain("1 Jan 2026");
  });

  it("preserves the last day of the year", () => {
    expect(fmtDate("2026-12-31")).toContain("31 Des 2026");
  });

  it("includes both endpoints across month and year boundaries", () => {
    expect(inclusiveDateRange("2026-12-31", "2027-01-02")).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("returns no dates for a reversed range", () => {
    expect(inclusiveDateRange("2027-01-02", "2027-01-01")).toEqual([]);
  });

  it("supports one-day reservations and detects overlaps on interior dates", () => {
    expect(inclusiveDateRange("2027-02-01", "2027-02-01")).toEqual(["2027-02-01"]);
    expect(hasDateConflict("2027-02-01", "2027-02-03", new Set(["2027-02-02"]))).toBe(true);
    expect(hasDateConflict("2027-02-01", "2027-02-03", new Set(["2027-02-04"]))).toBe(false);
  });
});