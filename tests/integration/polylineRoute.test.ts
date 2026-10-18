import { describe, expect, it, vi } from "vitest";
import { makeResponse, textResponse } from "../helpers/directions.js";
import { computePolylineRoute } from "../../src/polylineRoute.js";
import { RateLimiter } from "../../src/rateLimiter.js";
import type { Coordinates } from "../../src/types.js";

/** A response with `legCount` legs, each `seconds` long and `meters` long. */
function legResponse(legCount: number, seconds = 60, meters = 100, withTraffic = true, withGeometry = false): unknown {
  const summary = [9, "test", [meters * legCount, "x", 0], [seconds * legCount, "x"], null, null, null, null, null, null, []];
  const route: unknown[] = [];
  route[0] = summary;
  route[1] = Array.from({ length: legCount }, () => [
    [9, null, [meters, "x", 0], [seconds, "x"], null, null, null, null, null, null, withTraffic ? [[seconds, "x"]] : []],
    [],
  ]);
  route[5] = "route-id";
  const data = makeResponse([route]) as unknown[];
  if (withGeometry) {
    // Four points at ~0.00001 deg steps, as E7 deltas.
    (data[0] as unknown[])[7] = [[[69000000, 100000, 100000, 100000], [799000000, 100000, 100000, 100000]]];
  }
  return data;
}

/** A response with a route line and a single leg. */
function geometryResponse(geometry: unknown): unknown {
  const data = legResponse(1, 60, 100, true, true) as unknown[];
  (data[0] as unknown[])[7] = [geometry];
  return data;
}

function clientOf(...responses: unknown[]): { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn();
  for (const response of responses) {
    fetch.mockResolvedValueOnce(textResponse(`)]}'\n${JSON.stringify(response)}`));
  }
  return { fetch };
}

function points(count: number): Coordinates[] {
  return Array.from({ length: count }, (_, index) => ({ latitude: index * 0.001, longitude: 0 }));
}

const BASE = {
  simplify: 0,
  maxGap: 0,
  maxPointsPerRequest: 2,
  snap: false,
  snapGap: 500,
  language: "en",
  region: "us",
} as const;

const START = 1_800_000_000;

function calls(client: { fetch: ReturnType<typeof vi.fn> }): string[] {
  return client.fetch.mock.calls.map((call) => decodeURIComponent(call[0] as string));
}

describe("computePolylineRoute", () => {
  it("chains the departure across chunks", async () => {
    const client = clientOf(legResponse(1), legResponse(1), legResponse(1), legResponse(1));
    const limiter = new RateLimiter(1000);

    const route = await computePolylineRoute({
      ...BASE,
      points: points(5),
      departureTime: START,
      client: client as never,
      limiter,
    });

    expect(client.fetch).toHaveBeenCalledTimes(4);
    expect(route.legs).toHaveLength(4);
    expect(route.waypoints).toHaveLength(5);
    expect(route.legs[0]!.departure!.seconds).toBe(START);
    expect(route.legs[3]!.arrival!.seconds).toBe(START + 4 * 60);
    expect(route.waypoints.at(-1)!.arrival!.seconds).toBe(START + 4 * 60);

    const urls = calls(client);
    expect(urls[0]).toContain(`3j${START}`);
    expect(urls[1]).toContain(`3j${START + 60}`);
    expect(urls[2]).toContain(`3j${START + 120}`);
    expect(urls[3]).toContain(`3j${START + 180}`);
  });

  it("returns a single request when the path fits", async () => {
    const client = clientOf(legResponse(2));
    const limiter = new RateLimiter(1000);

    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: points(3),
      departureTime: START,
      client: client as never,
      limiter,
    });

    expect(client.fetch).toHaveBeenCalledTimes(1);
    expect(route.legs).toHaveLength(2);
    expect(route.waypoints).toHaveLength(3);
  });

  it("keeps the dense input as overview_path and the control points as waypoints", async () => {
    const client = clientOf(legResponse(2));
    const limiter = new RateLimiter(1000);
    const dense = points(3);

    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: dense,
      departureTime: START,
      client: client as never,
      limiter,
    });

    expect(route.overview_path).toEqual(dense);
    expect(route.waypoints.map((waypoint) => waypoint.coordinates)).toEqual(dense);
  });

  it("chains an arrival deadline backward then refines forward", async () => {
    const arrival = START + 1000;
    const client = clientOf(...Array.from({ length: 8 }, () => legResponse(1)));
    const limiter = new RateLimiter(1000);

    const route = await computePolylineRoute({
      ...BASE,
      points: points(5),
      arrivalTime: arrival,
      client: client as never,
      limiter,
    });

    // four backward requests, then four forward
    expect(client.fetch).toHaveBeenCalledTimes(8);
    expect(route.legs).toHaveLength(4);
    // with constant durations the final arrival lands on the deadline
    expect(route.legs.at(-1)!.arrival!.seconds).toBe(arrival);
    expect(route.legs[0]!.departure!.seconds).toBe(arrival - 4 * 60);
  });

  it("rejects a path with fewer than two distinct points", async () => {
    const client = clientOf();
    await expect(
      computePolylineRoute({
        ...BASE,
        points: [
          { latitude: 1, longitude: 1 },
          { latitude: 1, longitude: 1 },
        ],
        client: client as never,
        limiter: new RateLimiter(1000),
      }),
    ).rejects.toThrow(/at least two distinct points/);
  });

  it("throws when a chunk returns no route", async () => {
    const client = clientOf(makeResponse([]));
    await expect(
      computePolylineRoute({
        ...BASE,
        points: points(3),
        departureTime: START,
        client: client as never,
        limiter: new RateLimiter(1000),
      }),
    ).rejects.toThrow(/No route found/);
  });

  it("throws when a chunk returns a route with no legs", async () => {
    const client = clientOf(legResponse(0));
    await expect(
      computePolylineRoute({
        ...BASE,
        maxPointsPerRequest: 100,
        points: points(3),
        departureTime: START,
        client: client as never,
        limiter: new RateLimiter(1000),
      }),
    ).rejects.toThrow(/No route found/);
  });

  it("aggregates and formats distance and duration", async () => {
    const client = clientOf(legResponse(3, 1800, 600));
    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: points(4),
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.distance).toEqual({ meters: 1800, text: "1.8 km" });
    expect(route.duration).toEqual({ seconds: 5400, text: "1 hr 30 min" });
    expect(route.duration_in_traffic).toEqual({ seconds: 5400, text: "1 hr 30 min" });
  });

  it("tolerates a response with fewer legs than the control points", async () => {
    const client = clientOf(legResponse(1));
    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: points(4),
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.legs).toHaveLength(1);
    expect(route.waypoints).toHaveLength(4);
  });

  it("falls back to the static duration when a leg has no traffic", async () => {
    const client = clientOf(legResponse(1, 30, 100, false));
    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: points(2),
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.legs[0]!.duration_in_traffic).toBeNull();
    expect(route.duration).toEqual({ seconds: 30, text: "30 sec" });
    expect(route.duration_in_traffic).toEqual({ seconds: 30, text: "30 sec" });
  });

  it("reports no traffic total when every leg has no duration", async () => {
    const client = clientOf(legResponse(1, 0, 0));
    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: points(2),
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.duration_in_traffic).toBeNull();
    expect(route.distance).toEqual({ meters: 0, text: "0 m" });
  });

  it("uses the local clock when no time is given", async () => {
    const client = clientOf(legResponse(1));
    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: points(2),
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.legs[0]!.departure!.seconds).toBeGreaterThan(0);
  });

  it("keeps points that differ only in longitude", async () => {
    const client = clientOf(legResponse(2));
    const route = await computePolylineRoute({
      ...BASE,
      maxPointsPerRequest: 100,
      points: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0.001 },
        { latitude: 0, longitude: 0.002 },
      ],
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.waypoints).toHaveLength(3);
  });

  it("times Google's own geometry when snap is on", async () => {
    // one geometry-pass request, then one timing-pass request
    const client = clientOf(legResponse(2, 60, 100, true, true), legResponse(3, 60, 100));
    const route = await computePolylineRoute({
      ...BASE,
      snap: true,
      maxPointsPerRequest: 100,
      points: points(3),
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(client.fetch).toHaveBeenCalledTimes(2);
    expect(route.geometry).toHaveLength(4);
    expect(route.waypoints).toHaveLength(4);
    expect(route.legs).toHaveLength(3);
  });

  it("falls back to the control points when no geometry comes back", async () => {
    const client = clientOf(legResponse(2, 60, 100), legResponse(2, 60, 100));
    const route = await computePolylineRoute({
      ...BASE,
      snap: true,
      maxPointsPerRequest: 100,
      points: points(3),
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.geometry).toBeNull();
    expect(route.waypoints).toHaveLength(3);
    expect(route.legs).toHaveLength(2);
  });

  it("dedupes the geometry line", async () => {
    // (6.9,79.9), a duplicate of it, then (6.9,79.91): exercises the equal
    // latitude and the duplicate branches.
    const geometry = [
      [69000000, 0, 0],
      [799000000, 0, 100000],
    ];
    const client = clientOf(geometryResponse(geometry), legResponse(2, 60, 100));
    const route = await computePolylineRoute({
      ...BASE,
      snap: true,
      maxPointsPerRequest: 100,
      points: points(2),
      departureTime: START,
      client: client as never,
      limiter: new RateLimiter(1000),
    });

    expect(route.geometry).toHaveLength(2);
    expect(route.waypoints).toHaveLength(2);
  });
});
