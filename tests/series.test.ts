import { describe, expect, it } from "vitest";
import { buildSeries, computeSummary, type AirLog } from "@/lib/air";

/** Row factory: seconds from a fixed epoch, one varying field. */
function row(sec: number, gas: number): AirLog {
  return {
    ts: new Date(Date.UTC(2026, 0, 1, 0, 0, sec)).toISOString(),
    gas,
    temp: 30,
    hum: 60,
    ldr: 100,
    fan: 0,
    status: "BAIK",
  };
}

describe("buildSeries", () => {
  it("returns nothing for empty rows", () => {
    expect(buildSeries([], (r) => r.gas)).toEqual([]);
  });

  it("sorts unsorted input ascending", () => {
    const pts = buildSeries([row(20, 300), row(0, 100), row(10, 200)], (r) => r.gas);
    const nonNull = pts.map((p) => p.v).filter((v) => v !== null);
    expect(nonNull).toEqual([100, 200, 300]);
  });

  it("caps the point count at maxPoints", () => {
    const rows = Array.from({ length: 600 }, (_, i) => row(i * 5, i));
    const pts = buildSeries(rows, (r) => r.gas, 150);
    expect(pts.length).toBeLessThanOrEqual(150);
  });

  it("averages rows that share a bucket", () => {
    // 25 s span, 3 buckets of 12.5 s: 0/5/10 s share bucket 0, 15/20 s bucket 1, 25 s (the
    // boundary) bucket 2.
    const rows = [row(0, 100), row(5, 200), row(10, 300), row(15, 400), row(20, 500), row(25, 600)];
    const pts = buildSeries(rows, (r) => r.gas, 3);
    expect(pts.length).toBe(3);
    expect(pts[0].v).toBe(200);
    expect(pts[1].v).toBe(450);
    expect(pts[2].v).toBe(600);
  });

  it("leaves empty buckets as null gaps", () => {
    const pts = buildSeries([row(0, 100), row(60, 400)], (r) => r.gas, 30);
    expect(pts[0].v).toBe(100);
    expect(pts.at(-1)!.v).toBe(400);
    expect(pts.slice(1, -1).some((p) => p.v === null)).toBe(true);
  });
});

describe("computeSummary", () => {
  it("reduces min, max and mean", () => {
    const rows = [row(0, 100), row(5, 900), row(10, 200)];
    const s = computeSummary(rows, (r) => r.gas);
    expect(s.min).toBe(100);
    expect(s.max).toBe(900);
    expect(s.avg).toBe(400);
  });

  it("returns zeros for no rows", () => {
    expect(computeSummary([], (r) => r.gas)).toEqual({ min: 0, max: 0, avg: 0 });
  });
});
