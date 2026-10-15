import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeResponse, makeRoute, textResponse } from "../helpers/directions.js";

const { mockFetch, mockWarmUpFetch } = vi.hoisted(() => ({ mockFetch: vi.fn(), mockWarmUpFetch: vi.fn() }));

vi.mock("../../src/client.js", () => ({
  createClient: () => ({
    fetch: (url: string) => (url.includes("maps.google.com/") ? mockWarmUpFetch(url) : mockFetch(url)),
  }),
}));

import { computeRouteMatrix, MAX_MATRIX_ELEMENTS } from "../../src/matrix.js";
import { WARM_UP_URL } from "../../src/warmup.js";
import type { ComputeRouteMatrixOptions, MatrixElement } from "../../src/types.js";

/**
 * Run computeRouteMatrix without real pacing: every request would otherwise
 * wait a second for the next slot. Pacing is covered by the rate limiter tests.
 */
function compute(options: ComputeRouteMatrixOptions) {
  return computeRouteMatrix({ requests_per_second: 1000, ...options });
}

function cellOf(elements: MatrixElement[], originIndex: number, destinationIndex: number): MatrixElement | undefined {
  return elements.find((e) => e.origin_index === originIndex && e.destination_index === destinationIndex);
}

beforeEach(() => {
  mockFetch.mockReset();
  mockWarmUpFetch.mockReset();
  mockWarmUpFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK", text: async () => "<html></html>" });
});

describe("computeRouteMatrix", () => {
  it("returns a flat element for every origin/destination pair", async () => {
    for (let index = 0; index < 4; index++) {
      mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));
    }

    const matrix = await compute({ origins: ["O1", "O2"], destinations: ["D1", "D2"] });

    expect(matrix.origins).toHaveLength(2);
    expect(matrix.destinations).toHaveLength(2);
    expect(matrix.elements).toHaveLength(4);

    const cell = cellOf(matrix.elements, 0, 0);
    expect(cell).toMatchObject({ status: "OK", condition: "ROUTE_EXISTS" });
    expect(cell?.distance).toEqual({ meters: 1200, text: "1.2 km" });
    expect(cell?.duration).toEqual({ seconds: 330, text: "6 min" });
    expect(cell?.static_duration).toEqual({ seconds: 300, text: "5 min" });
    expect(cellOf(matrix.elements, 1, 1)).toMatchObject({ origin_index: 1, destination_index: 1, status: "OK" });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("warms up the cookie jar once before computing the matrix", async () => {
    mockFetch.mockResolvedValue(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const matrix = await compute({ origins: ["O1", "O2"], destinations: ["D1"] });

    expect(mockWarmUpFetch).toHaveBeenCalledWith(WARM_UP_URL);
    expect(mockWarmUpFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(matrix.elements).toHaveLength(2);
  });

  it("marks failed pairs as ERROR without rejecting the matrix", async () => {
    mockFetch
      .mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))))
      .mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const matrix = await compute({ origins: ["O1", "O2"], destinations: ["D1", "D2"], concurrency: 1 });

    expect(cellOf(matrix.elements, 0, 0)).toMatchObject({ status: "OK", condition: "ROUTE_EXISTS" });
    expect(cellOf(matrix.elements, 0, 1)).toMatchObject({ status: "ERROR", condition: "ROUTE_NOT_FOUND", distance: null });
    expect(cellOf(matrix.elements, 1, 0)).toMatchObject({ status: "ERROR", condition: "ROUTE_NOT_FOUND" });
    expect(cellOf(matrix.elements, 1, 1)).toMatchObject({ status: "OK", condition: "ROUTE_EXISTS" });
  });

  it("applies the travel mode to every request", async () => {
    mockFetch.mockResolvedValue(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    await compute({ origins: ["O"], destinations: ["D"], travel_mode: "two_wheeler" });

    const calledUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl).toContain("1e9");
  });

  it("falls back to the static duration when no live traffic is reported", async () => {
    const noTraffic = makeRoute({ 0: [9, "Main St", [100, "100 m"], [50, "1 min"]] });
    mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([noTraffic]))));

    const matrix = await compute({ origins: ["O"], destinations: ["D"] });

    expect(matrix.elements[0]!.duration).toEqual({ seconds: 50, text: "1 min" });
    expect(matrix.elements[0]!.static_duration).toEqual({ seconds: 50, text: "1 min" });
  });

  it("rejects an empty origin list", async () => {
    await expect(compute({ origins: [], destinations: ["D"] })).rejects.toThrow(/At least one origin/);
  });

  it("rejects an empty destination list", async () => {
    await expect(compute({ origins: ["O"], destinations: [] })).rejects.toThrow(/At least one destination/);
  });

  it("rejects invalid concurrency", async () => {
    await expect(compute({ origins: ["O"], destinations: ["D"], concurrency: 0 })).rejects.toThrow(/Invalid concurrency/);
  });

  it("rejects an invalid requests_per_second", async () => {
    await expect(compute({ origins: ["O"], destinations: ["D"], requests_per_second: 0 })).rejects.toThrow(
      /Invalid requests per second/,
    );
  });

  it("rejects a matrix larger than the documented element limit", async () => {
    const size = Math.ceil(Math.sqrt(MAX_MATRIX_ELEMENTS)) + 1;
    await expect(
      compute({
        origins: Array.from({ length: size }, (_, index) => `O${index}`),
        destinations: Array.from({ length: size }, (_, index) => `D${index}`),
      }),
    ).rejects.toThrow(/exceeds the limit/);
  });
});
