import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeResponse, makeRoute, textResponse } from "../helpers/directions.js";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("../../src/client.js", () => ({
  createClient: () => ({ fetch: mockFetch }),
}));

import { computeRouteMatrix } from "../../src/matrix.js";

beforeEach(() => {
  mockFetch.mockReset();
});

describe("computeRouteMatrix", () => {
  it("builds a matrix of cells for every origin/destination pair", async () => {
    for (let index = 0; index < 4; index++) {
      mockFetch.mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));
    }

    const matrix = await computeRouteMatrix({ origins: ["O1", "O2"], destinations: ["D1", "D2"] });

    expect(matrix.origins).toHaveLength(2);
    expect(matrix.destinations).toHaveLength(2);
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]?.elements).toHaveLength(2);

    const cell = matrix.rows[0]?.elements[0];
    expect(cell).toMatchObject({ origin_index: 0, destination_index: 0, status: "OK" });
    expect(cell?.distance).toEqual({ meters: 1200, text: "1.2 km" });
    expect(cell?.duration).toEqual({ seconds: 300, text: "5 min" });
    expect(cell?.duration_in_traffic).toEqual({ seconds: 330, text: "6 min" });

    expect(matrix.rows[1]?.elements[1]).toMatchObject({ origin_index: 1, destination_index: 1, status: "OK" });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("marks failed pairs as ERROR without rejecting the matrix", async () => {
    mockFetch
      .mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([]))))
      .mockResolvedValueOnce(textResponse(JSON.stringify(makeResponse([makeRoute()]))));

    const matrix = await computeRouteMatrix({ origins: ["O1", "O2"], destinations: ["D1", "D2"], concurrency: 1 });

    expect(matrix.rows[0]?.elements[0]?.status).toBe("OK");
    expect(matrix.rows[0]?.elements[1]?.status).toBe("ERROR");
    expect(matrix.rows[0]?.elements[1]?.distance).toBeNull();
    expect(matrix.rows[1]?.elements[0]?.status).toBe("ERROR");
    expect(matrix.rows[1]?.elements[1]?.status).toBe("OK");
  });

  it("rejects an empty origin list", async () => {
    await expect(computeRouteMatrix({ origins: [], destinations: ["D"] })).rejects.toThrow(/At least one origin/);
  });

  it("rejects an empty destination list", async () => {
    await expect(computeRouteMatrix({ origins: ["O"], destinations: [] })).rejects.toThrow(/At least one destination/);
  });

  it("rejects invalid concurrency", async () => {
    await expect(
      computeRouteMatrix({ origins: ["O"], destinations: ["D"], concurrency: 0 }),
    ).rejects.toThrow(/Invalid concurrency/);
  });
});
