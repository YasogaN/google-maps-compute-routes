import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeResponse, makeRoute, textResponse } from "../helpers/directions.js";

const { mockFetch, mockWarmUpFetch } = vi.hoisted(() => ({ mockFetch: vi.fn(), mockWarmUpFetch: vi.fn() }));

vi.mock("../../src/client.js", () => ({
  createClient: () => ({
    fetch: (url: string) => (url.includes("maps.google.com/") ? mockWarmUpFetch(url) : mockFetch(url)),
  }),
}));

import { computeRoutes } from "../../src/index.js";
import { encodePolyline } from "../../src/polyline.js";
import { WARM_UP_URL } from "../../src/warmup.js";
import type { ComputeRoutesOptions, ParsedRoute } from "../../src/types.js";

/**
 * Run computeRoutes without real pacing: every request would otherwise wait a
 * second for the next slot. Pacing is covered by the rate limiter unit tests.
 */
function compute(options: ComputeRoutesOptions) {
  return computeRoutes({ requests_per_second: 1000, ...options });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockWarmUpFetch.mockReset();
  mockWarmUpFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK", text: async () => "<html></html>" });
});

describe("computeRoutes pipeline (integration)", () => {
  it("runs the full pipeline against a fake HTTP client", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(`)]}'\n${JSON.stringify(makeResponse([makeRoute()]))}`));

    const routes = (await compute({ origin: "A", destination: "B", clean: true })) as ParsedRoute[];

    expect(routes).toHaveLength(1);
    expect(routes[0]?.summary).toBe("Main St");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("warms up the cookie jar before requesting directions", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    await compute({ origin: "A", destination: "B", clean: true });

    expect(mockWarmUpFetch).toHaveBeenCalledWith(WARM_UP_URL);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockWarmUpFetch.mock.invocationCallOrder[0]).toBeLessThan(mockFetch.mock.invocationCallOrder[0]!);
  });

  it("returns the raw array when clean is false", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const result = await compute({ origin: "A", destination: "B" });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("passes the built directions URL, language and region to the client", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await compute({ origin: "A", destination: "B", language: "fr", region: "lk" });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("preview/directions");
    expect(calledUrl).toContain("pb=");
    expect(calledUrl).toContain("hl=fr");
    expect(calledUrl).toContain("gl=lk");
  });

  it("accepts a directions URL and extracts the waypoints", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await compute({ url: "https://www.google.com/maps/dir/Probike/Factory/", clean: true });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("1sProbike");
    expect(calledUrl).toContain("1sFactory");
  });

  it("passes a departure time into the pb", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await compute({ origin: "A", destination: "B", departure_time: 1800000000 });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("19m3!1e0!2e2!3j1800000000");
  });

  it("converts a Date arrival time into the pb", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await compute({ origin: "A", destination: "B", arrival_time: new Date(1800000000000) });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("19m3!1e1!2e2!3j1800000000");
  });

  it("passes intermediate waypoints through to the request", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await compute({ origin: "A", destination: "D", waypoints: ["B", "C"] });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("1sA");
    expect(calledUrl).toContain("1sB");
    expect(calledUrl).toContain("1sC");
    expect(calledUrl).toContain("1sD");
  });

  it("requests the geometry flag and returns the route line when geometry is true", async () => {
    const geometry = [[[1000, 1000], [1000, 1000]]];
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()], geometry))));

    const routes = (await compute({ origin: "A", destination: "B", waypoints: ["C"], geometry: true, clean: true })) as ParsedRoute[];

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("14b1");
    expect(routes[0]!.geometry).toEqual([
      { latitude: 0.0001, longitude: 0.0001 },
      { latitude: 0.0002, longitude: 0.0002 },
    ]);
  });

  it("omits the geometry flag and returns null geometry when geometry is not requested", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const routes = (await compute({ origin: "A", destination: "B", waypoints: ["C"], clean: true })) as ParsedRoute[];

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).not.toContain("14b1");
    expect(routes[0]!.geometry).toBeNull();
  });

  it("builds a route from an encoded polyline", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const polyline = encodePolyline([
      { latitude: 6.91191, longitude: 79.93237 },
      { latitude: 6.90777, longitude: 79.9304 },
      { latitude: 6.90215, longitude: 79.9153 },
    ]);
    // Disable simplification so every decoded point is sent as-is.
    await compute({ polyline, simplify: 0, max_gap: 0, snap: false, clean: true });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("6.91191,79.93237");
    expect(calledUrl).toContain("6.90777,79.9304");
    expect(calledUrl).toContain("6.90215,79.9153");
  });

  it("chunks a long polyline and returns one merged route", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const polyline = [
      { latitude: 6.9, longitude: 79.9 },
      { latitude: 6.91, longitude: 79.91 },
      { latitude: 6.92, longitude: 79.92 },
    ];
    const routes = (await compute({
      polyline,
      simplify: 0,
      max_gap: 0,
      max_points_per_request: 2,
      snap: false,
      departure_time: 1800000000,
      clean: true,
    })) as ParsedRoute[];

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.waypoints).toHaveLength(3);
    expect(routes[0]!.legs).toHaveLength(2);
    expect(routes[0]!.legs[0]!.departure).toEqual({ seconds: 1800000000, text: "2027-01-15T08:00:00.000Z" });

    const urls = mockFetch.mock.calls.map((call) => decodeURIComponent(call[0] as string));
    expect(urls[0]).toContain("3j1800000000");
    // the second chunk departs after the first leg's traffic duration (330 s)
    expect(urls[1]).toContain("3j1800000330");
  });

  it("snaps a polyline by default", async () => {
    mockFetch.mockResolvedValue(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    await compute({
      polyline: [
        { latitude: 6.9, longitude: 79.9 },
        { latitude: 6.92, longitude: 79.92 },
      ],
      clean: true,
    });

    // one geometry pass, then one timing pass, and the request asks for geometry
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(mockFetch.mock.calls[0]![0] as string)).toContain("14b1");
  });

  it("ignores geometry on the polyline path, which requests the flag itself", async () => {
    mockFetch.mockResolvedValue(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    await compute({
      polyline: [
        { latitude: 6.9, longitude: 79.9 },
        { latitude: 6.92, longitude: 79.92 },
      ],
      geometry: false,
      clean: true,
    });

    // The snap pass still asks for the route line even though the caller said false.
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(mockFetch.mock.calls[0]![0] as string)).toContain("14b1");
  });

  it("uses the default simplification and a polyline arrival deadline", async () => {
    mockFetch.mockResolvedValue(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    await compute({
      polyline: [
        { latitude: 6.9, longitude: 79.9 },
        { latitude: 6.92, longitude: 79.92 },
      ],
      arrival_time: 1800000000,
      snap: false,
      clean: true,
    });

    // one backward request, then one forward refinement
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("prefers explicit waypoints over the URL", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await compute({ url: "https://www.google.com/maps/dir/From/To/", origin: "Override", destination: "Target" });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("1sOverride");
    expect(calledUrl).toContain("1sTarget");
  });

  it("wraps failures in a Scraper Error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    await expect(compute({ origin: "A", destination: "B" })).rejects.toThrow(/Scraper Error: network down/);
  });

  it("wraps a non-Error rejection", async () => {
    mockFetch.mockRejectedValueOnce("boom");
    await expect(compute({ origin: "A", destination: "B" })).rejects.toThrow(/Scraper Error: boom/);
  });

  it("rejects invalid input", async () => {
    await expect(compute({ url: "https://example.com/maps/dir/A/B/" })).rejects.toThrow(/Scraper Error: Invalid host/);
  });

  it("rejects an invalid requests_per_second", async () => {
    await expect(compute({ origin: "A", destination: "B", requests_per_second: 0 })).rejects.toThrow(
      /Scraper Error: Invalid requests per second/,
    );
  });
});
