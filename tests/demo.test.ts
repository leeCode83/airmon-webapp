import { describe, expect, it } from "vitest";
import { statusForGas } from "@/lib/air";
import { demoLogs } from "@/lib/demo";

describe("demoLogs", () => {
  const rows = demoLogs();

  it("covers the week at the one-minute cadence, ending now", () => {
    expect(rows.length).toBe(10_080);
    const spanS =
      (+new Date(rows.at(-1)!.ts) - +new Date(rows[0].ts)) / 1000;
    expect(spanS).toBe((10_080 - 1) * 60);
    expect(Date.now() - +new Date(rows.at(-1)!.ts)).toBeLessThan(10_000);
  });

  it("agrees with the domain rules: status from gas, fan from status", () => {
    for (const r of rows) {
      expect(r.status).toBe(statusForGas(r.gas));
      expect(r.fan).toBe(r.status === "BAIK" ? 0 : 1);
    }
  });

  it("stays inside the sensor ranges", () => {
    for (const r of rows) {
      expect(r.gas).toBeGreaterThanOrEqual(0);
      expect(r.gas).toBeLessThanOrEqual(4095);
      expect(r.temp).toBeGreaterThan(20);
      expect(r.temp).toBeLessThan(40);
      expect(r.hum).toBeGreaterThan(30);
      expect(r.hum).toBeLessThan(90);
    }
  });

  it("tells the story: mostly clean air with one bad spike", () => {
    const baik = rows.filter((r) => r.status === "BAIK").length;
    expect(rows.some((r) => r.status === "SEDANG")).toBe(true);
    expect(rows.some((r) => r.status === "BURUK")).toBe(true);
    expect(baik).toBeGreaterThan(3000);
  });

  it("is deterministic across calls", () => {
    expect(demoLogs().slice(0, 10).map((r) => r.gas)).toEqual(
      rows.slice(0, 10).map((r) => r.gas),
    );
  });
});
