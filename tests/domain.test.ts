import { describe, expect, it } from "vitest";
import {
  badCauses,
  chartDomain,
  fanLabel,
  formatClock,
  formatGas,
  formatHum,
  formatTemp,
  formatTime,
  isEarlyWarning,
  isNight,
  statusForGas,
  tempLimit,
  type AirLog,
} from "@/lib/air";

/** Minimal row: a gas verdict with an optional forecast. */
function log(gas: number, status: AirLog["status"], pred?: number | null): AirLog {
  return { ts: "2026-01-01T00:00:00Z", gas, temp: 30, hum: 60, ldr: 100, fan: 0, status, pred };
}

describe("statusForGas", () => {
  it("classifies at the firmware calibration boundaries", () => {
    expect(statusForGas(0)).toBe("BAIK");
    expect(statusForGas(699)).toBe("BAIK");
    expect(statusForGas(700)).toBe("SEDANG");
    expect(statusForGas(1199)).toBe("SEDANG");
    expect(statusForGas(1200)).toBe("BURUK");
    expect(statusForGas(4095)).toBe("BURUK");
  });
});

describe("isNight", () => {
  it("reads high LDR values as night (module reads high in the dark)", () => {
    expect(isNight(3500)).toBe(false);
    expect(isNight(3501)).toBe(true);
    expect(isNight(4095)).toBe(true);
  });
});

describe("isEarlyWarning", () => {
  it("fires on the firmware's 700 line while the verdict is still BAIK", () => {
    expect(isEarlyWarning(log(150, "BAIK", 700))).toBe(true);
    expect(isEarlyWarning(log(150, "BAIK", 2400))).toBe(true);
    expect(isEarlyWarning(log(150, "BAIK", 699))).toBe(false);
  });

  it("stays quiet once the verdict itself has moved", () => {
    expect(isEarlyWarning(log(750, "SEDANG", 900))).toBe(false);
    expect(isEarlyWarning(log(1300, "BURUK", 1500))).toBe(false);
  });

  it("is false without a forecast (MLP warming up)", () => {
    expect(isEarlyWarning(log(150, "BAIK", null))).toBe(false);
    expect(isEarlyWarning(log(150, "BAIK"))).toBe(false);
  });
});

describe("tempLimit", () => {
  it("mirrors the firmware day and night cutoffs", () => {
    expect(tempLimit(false)).toBe(35);
    expect(tempLimit(true)).toBe(30);
  });
});

describe("badCauses", () => {
  const base = {
    ts: "2026-10-29T10:00:00Z",
    hum: 60,
    fan: 1 as const,
    status: "BURUK" as const,
  };

  it("blames gas alone once it reaches 1,200", () => {
    expect(badCauses({ ...base, gas: 1200, temp: 30, ldr: 500 })).toEqual([
      "Gas at 1,200 ADC, above the 1,200 cutoff.",
    ]);
    expect(badCauses({ ...base, gas: 2400, temp: 30, ldr: 500 })).toEqual([
      "Gas at 2,400 ADC, above the 1,200 cutoff.",
    ]);
  });

  it("blames temperature alone past the day limit", () => {
    expect(badCauses({ ...base, gas: 800, temp: 35.6, ldr: 500 })).toEqual([
      "Temperature at 35.6 °C, above the 35.0 °C day limit.",
    ]);
  });

  it("uses the night limit when the LDR reads dark", () => {
    expect(badCauses({ ...base, gas: 800, temp: 30.4, ldr: 3700 })).toEqual([
      "Temperature at 30.4 °C, above the 30.0 °C night limit.",
    ]);
  });

  it("names both causes together", () => {
    expect(badCauses({ ...base, gas: 2100, temp: 36, ldr: 500 })).toEqual([
      "Gas at 2,100 ADC, above the 1,200 cutoff.",
      "Temperature at 36.0 °C, above the 35.0 °C day limit.",
    ]);
  });

  it("returns empty just under both cutoffs (firmware hysteresis case)", () => {
    expect(badCauses({ ...base, gas: 1199, temp: 35.0, ldr: 500 })).toEqual([]);
  });
});

describe("chartDomain", () => {
  it("pads the data extent so the line clears the plot edges", () => {
    const d = chartDomain([400, 2615]);
    expect(d.min).toBeCloseTo(400 - (2615 - 400) * 0.08, 6);
    expect(d.max).toBeCloseTo(2615 + (2615 - 400) * 0.08, 6);
  });

  it("gives a flat series a symmetric window of ±10% around the value", () => {
    expect(chartDomain([30.0])).toEqual({ min: 27, max: 33 });
    expect(chartDomain([0])).toEqual({ min: -1, max: 1 });
    expect(chartDomain([])).toEqual({ min: 0, max: 1 });
  });
});

describe("fanLabel", () => {
  it("maps the 0/1 actuator field to words", () => {
    expect(fanLabel(1)).toBe("ON");
    expect(fanLabel(0)).toBe("OFF");
  });
});

describe("formatters", () => {
  it("formats gas as a grouped integer", () => {
    expect(formatGas(2778)).toBe("2,778");
    expect(formatGas(98)).toBe("98");
  });

  it("keeps one decimal for temperature and humidity", () => {
    expect(formatTemp(31.44)).toBe("31.4");
    expect(formatTemp(31.46)).toBe("31.5");
    expect(formatHum(63)).toBe("63.0");
  });

  it("formats time-of-day from a local date", () => {
    expect(formatTime(new Date(2026, 9, 25, 14, 32))).toBe("14:32");
    expect(formatClock(new Date(2026, 9, 25, 14, 32, 5))).toBe("14:32:05");
  });
});
