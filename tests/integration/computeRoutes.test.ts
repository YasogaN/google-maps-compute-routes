import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeResponse, makeRoute, textResponse } from "../helpers/directions.js";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("../../src/client.js", () => ({
  createClient: () => ({ fetch: mockFetch }),
}));

import { computeRoutes } from "../../src/index.js";
import { encodePolyline } from "../../src/polyline.js";
import type { ParsedRoute } from "../../src/types.js";

beforeEach(() => {
  mockFetch.mockReset();
});

describe("computeRoutes pipeline (integration)", () => {
  it("runs the full pipeline against a fake HTTP client", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(`)]}'\n${JSON.stringify(makeResponse([makeRoute()]))}`));

    const routes = (await computeRoutes({ origin: "A", destination: "B", clean: true })) as ParsedRoute[];

    expect(routes).toHaveLength(1);
    expect(routes[0]?.summary).toBe("Main St");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns the raw array when clean is false", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const result = await computeRoutes({ origin: "A", destination: "B" });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("passes the built directions URL, language and region to the client", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await computeRoutes({ origin: "A", destination: "B", language: "fr", region: "lk" });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("preview/directions");
    expect(calledUrl).toContain("pb=");
    expect(calledUrl).toContain("hl=fr");
    expect(calledUrl).toContain("gl=lk");
  });

  it("accepts a directions URL and extracts the waypoints", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await computeRoutes({ url: "https://www.google.com/maps/dir/Probike/Factory/", clean: true });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("1sProbike");
    expect(calledUrl).toContain("1sFactory");
  });

  it("passes intermediate waypoints through to the request", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await computeRoutes({ origin: "A", destination: "D", waypoints: ["B", "C"] });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("1sA");
    expect(calledUrl).toContain("1sB");
    expect(calledUrl).toContain("1sC");
    expect(calledUrl).toContain("1sD");
  });

  it("builds a route from an encoded polyline", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const polyline = encodePolyline([
      { latitude: 6.91191, longitude: 79.93237 },
      { latitude: 6.90777, longitude: 79.9304 },
      { latitude: 6.90215, longitude: 79.9153 },
    ]);
    await computeRoutes({ polyline, clean: true });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("6.91191,79.93237");
    expect(calledUrl).toContain("6.90777,79.9304");
    expect(calledUrl).toContain("6.90215,79.9153");
  });

  it("prefers explicit waypoints over the URL", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))));

    await computeRoutes({ url: "https://www.google.com/maps/dir/From/To/", origin: "Override", destination: "Target" });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("1sOverride");
    expect(calledUrl).toContain("1sTarget");
  });

  it("wraps failures in a Scraper Error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    await expect(computeRoutes({ origin: "A", destination: "B" })).rejects.toThrow(/Scraper Error: network down/);
  });

  it("wraps a non-Error rejection", async () => {
    mockFetch.mockRejectedValueOnce("boom");
    await expect(computeRoutes({ origin: "A", destination: "B" })).rejects.toThrow(/Scraper Error: boom/);
  });

  it("rejects invalid input", async () => {
    await expect(computeRoutes({ url: "https://example.com/maps/dir/A/B/" })).rejects.toThrow(/Scraper Error: Invalid host/);
  });
});
