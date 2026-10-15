import { describe, expect, it } from "vitest";
import { fetchRoutes } from "../../src/utils.js";
import { asClient, clientOf, textResponse } from "../helpers/directions.js";

const base = {
  origin: { query: "A" },
  destination: { query: "B" },
  language: "en",
  region: "us",
};

describe("fetchRoutes", () => {
  it("parses json after the XSSI prefix", async () => {
    const client = clientOf(textResponse(")]}'\n[1,2]"));
    expect(await fetchRoutes({ ...base, client: asClient(client) })).toEqual([1, 2]);
  });

  it("parses json without the XSSI prefix", async () => {
    const client = clientOf(textResponse("[3,4]"));
    expect(await fetchRoutes({ ...base, client: asClient(client) })).toEqual([3, 4]);
  });

  it("throws on a non-ok response", async () => {
    const client = clientOf(textResponse("nope", false));
    await expect(fetchRoutes({ ...base, client: asClient(client) })).rejects.toThrow(/Failed to fetch/);
  });

  it("throws when no json payload is present", async () => {
    const client = clientOf(textResponse(")]}'"));
    await expect(fetchRoutes({ ...base, client: asClient(client) })).rejects.toThrow(/No valid JSON data/);
  });

  it("throws when the payload is not an array", async () => {
    const client = clientOf(textResponse("{}"));
    await expect(fetchRoutes({ ...base, client: asClient(client) })).rejects.toThrow(/Invalid JSON data/);
  });

  it("throws when the payload is not valid json", async () => {
    const client = clientOf(textResponse("[not json"));
    await expect(fetchRoutes({ ...base, client: asClient(client) })).rejects.toThrow();
  });
});
