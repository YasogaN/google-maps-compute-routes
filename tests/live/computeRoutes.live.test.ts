import { describe, expect, it } from "vitest";
import { computeRouteMatrix, computeRoutes } from "../../src/index.js";
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
    expect(first.legs).toHaveLength(1);
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
    expect(first.legs).toHaveLength(2);
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

  it("computes a route matrix", async () => {
    const matrix = await computeRouteMatrix({ origins: [ORIGIN], destinations: [DESTINATION], region: "lk" });

    expect(matrix.elements).toHaveLength(1);
    expect(matrix.elements[0]!.status).toBe("OK");
    expect(matrix.elements[0]!.condition).toBe("ROUTE_EXISTS");
    expect(matrix.elements[0]!.duration?.seconds).toBeGreaterThan(0);
    expect(matrix.elements[0]!.static_duration?.seconds).toBeGreaterThan(0);
  });

  it("honours the travel mode", async () => {
    const driving = (await computeRoutes({ origin: ORIGIN, destination: DESTINATION, region: "lk", travel_mode: "driving", clean: true })) as ParsedRoute[];
    const walking = (await computeRoutes({ origin: ORIGIN, destination: DESTINATION, region: "lk", travel_mode: "walking", clean: true })) as ParsedRoute[];

    expect(walking[0]!.duration.seconds).toBeGreaterThan(driving[0]!.duration.seconds);
  });

  it("plans the route for a chosen departure time", async () => {
    const departure = new Date(Date.now() + 3600 * 1000);
    const routes = (await computeRoutes({
      origin: ORIGIN,
      destination: DESTINATION,
      region: "lk",
      departure_time: departure,
      clean: true,
    })) as ParsedRoute[];

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0]!.duration.seconds).toBeGreaterThan(0);
    expect(routes[0]!.duration_in_traffic?.seconds).toBeGreaterThan(0);
  });

  it("returns a traffic-aware duration for each waypoint leg", async () => {
    const routes = (await computeRoutes({
      origin: "Nugegoda",
      destination: "Mount Lavinia",
      waypoints: ["Kaduwela"],
      region: "lk",
      departure_time: new Date(Date.now() + 3600 * 1000),
      clean: true,
    })) as ParsedRoute[];

    const legs = routes[0]!.legs;
    expect(legs).toHaveLength(2);
    expect(legs[0]!.duration_in_traffic).not.toBeNull();
    expect(legs[1]!.duration_in_traffic).not.toBeNull();
  });
});
