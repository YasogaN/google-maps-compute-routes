import { describe, expect, it } from "vitest";
import { backwardTiming, cumulativeTiming } from "../../src/timing.js";

describe("cumulativeTiming", () => {
  it("chains durations forward from the departure", () => {
    expect(cumulativeTiming([60, 120], 1000)).toEqual([
      { departure: 1000, arrival: 1060 },
      { departure: 1060, arrival: 1180 },
    ]);
  });

  it("returns nothing for no legs", () => {
    expect(cumulativeTiming([], 1000)).toEqual([]);
  });
});

describe("backwardTiming", () => {
  it("chains durations backward from the arrival", () => {
    expect(backwardTiming([60, 120], 2000)).toEqual([
      { departure: 1820, arrival: 1880 },
      { departure: 1880, arrival: 2000 },
    ]);
  });

  it("returns nothing for no legs", () => {
    expect(backwardTiming([], 2000)).toEqual([]);
  });

  it("round-trips with cumulativeTiming", () => {
    const durations = [30, 45, 600];
    const forward = cumulativeTiming(durations, 5000);
    expect(backwardTiming(durations, forward.at(-1)!.arrival)).toEqual(forward);
  });
});
