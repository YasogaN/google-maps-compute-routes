import { describe, expect, it } from "vitest";
import { computeRoutes } from "../../src/index.js";
import { contractViolations } from "../helpers/contract.js";
import type { JsonArray, ParsedRoute } from "../../src/types.js";

/**
 * A stable, publicly available origin/destination pair (Battaramulla, Sri Lanka)
 * used by the live suite.
 */
const ORIGIN = "Probike, Battaramulla";
const DESTINATION = "The Fab - Battaramulla";

describe("computeRoutes (live)", () => {
  it("returns at least one fully populated route", async () => {
    const routes = (await computeRoutes({ origin: ORIGIN, destination: DESTINATION, region: "lk", clean: true })) as ParsedRoute[];

    expect(routes.length).toBeGreaterThan(0);
    const first = routes[0]!;
    expect(first.distance.meters).toBeGreaterThan(0);
    expect(first.duration.seconds).toBeGreaterThan(0);
    expect(first.legs.length).toBeGreaterThan(0);
    expect(first.legs[0]!.steps.length).toBeGreaterThan(0);
    expect(first.legs[0]!.steps[0]!.maneuver.length).toBeGreaterThan(0);
  });

  it("matches the structural contract the parser relies on", async () => {
    const data = (await computeRoutes({ origin: ORIGIN, destination: DESTINATION, region: "lk" })) as JsonArray;
    expect(contractViolations(data)).toEqual([]);
  });
});
