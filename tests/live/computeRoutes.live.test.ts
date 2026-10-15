import { describe, expect, it } from "vitest";
import { computeRoutes } from "../../src/index.js";
import { encodePolyline } from "../../src/polyline.js";
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

  it("splits a waypoint route into one leg per stopover", async () => {
    const routes = (await computeRoutes({
      origin: ORIGIN,
      destination: DESTINATION,
      waypoints: ["Sasha Food Court Koswatta Battaramulla"],
      region: "lk",
      clean: true,
    })) as ParsedRoute[];

    const first = routes[0]!;
    expect(first.legs.length).toBeGreaterThan(1);
    expect(first.overview_path.length).toBeGreaterThan(0);
    expect(first.overview_path[0]!.latitude).toBeGreaterThan(0);
  });

  it("computes a route along a supplied polyline", async () => {
    const polyline = encodePolyline([
      { latitude: 6.91191, longitude: 79.93237 },
      { latitude: 6.90777, longitude: 79.9304 },
      { latitude: 6.90215, longitude: 79.9153 },
    ]);

    const routes = (await computeRoutes({ polyline, region: "lk", clean: true })) as ParsedRoute[];

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0]!.distance.meters).toBeGreaterThan(0);
    expect(routes[0]!.legs.length).toBeGreaterThan(1);
  });
});
