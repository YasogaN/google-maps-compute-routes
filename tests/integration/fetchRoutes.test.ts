import { describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../../src/rateLimiter.js";
import { fetchRoutes } from "../../src/utils.js";
import { asClient, clientOf, textResponse } from "../helpers/directions.js";

const base = {
  origin: { query: "A" },
  destination: { query: "B" },
  waypoints: [],
  language: "en",
  region: "us",
};

function routesWith(client: ReturnType<typeof clientOf>, limiter = new RateLimiter(1000)) {
  return fetchRoutes({ ...base, client: asClient(client), limiter });
}

describe("fetchRoutes", () => {
  it("parses json after the XSSI prefix", async () => {
    expect(await routesWith(clientOf(textResponse(")]}'\n[1,2]")))).toEqual([1, 2]);
  });

  it("parses json without the XSSI prefix", async () => {
    expect(await routesWith(clientOf(textResponse("[3,4]")))).toEqual([3, 4]);
  });

  it("throws on a non-ok response", async () => {
    await expect(routesWith(clientOf(textResponse("nope", false)))).rejects.toThrow(/Failed to fetch/);
  });

  it("throws when no json payload is present", async () => {
    await expect(routesWith(clientOf(textResponse(")]}'")))).rejects.toThrow(/No valid JSON data/);
  });

  it("throws when the payload is not an array", async () => {
    await expect(routesWith(clientOf(textResponse("{}")))).rejects.toThrow(/Invalid JSON data/);
  });

  it("throws when the payload is not valid json", async () => {
    await expect(routesWith(clientOf(textResponse("[not json")))).rejects.toThrow();
  });

  it("acquires a limiter slot before fetching", async () => {
    const order: string[] = [];
    const limiter = {
      acquire: vi.fn(async () => {
        order.push("acquire");
      }),
    };
    const client = {
      fetch: vi.fn(async () => {
        order.push("fetch");
        return textResponse("[1]");
      }),
    };

    await fetchRoutes({ ...base, client: asClient(client), limiter: limiter as never });

    expect(order).toEqual(["acquire", "fetch"]);
  });

  it("sends the fetch headers with a directions referer", async () => {
    const client = clientOf(textResponse("[1]"));

    await fetchRoutes({ ...base, client: asClient(client), limiter: new RateLimiter(1000) });

    const init = client.fetch.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers["Sec-Fetch-Dest"]).toBe("empty");
    expect(init.headers["Sec-Fetch-Mode"]).toBe("cors");
    expect(init.headers["Sec-Fetch-Site"]).toBe("same-origin");
    expect(init.headers["Referer"]).toBe("https://www.google.com/maps/dir/A/B/");
  });
});
