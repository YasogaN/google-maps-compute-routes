import { describe, expect, it } from "vitest";
import getDirectionsUrl from "../../src/directionsEndpoint.js";

function pbOf(url: string): string | null {
  return new URL(url).searchParams.get("pb");
}

/** The traffic-aware routing block every request carries. */
const TRAFFIC = "2m4!5m1!6e2!20e3!39b1";
// A request with just the traffic block.
const TRAFFIC_ONLY = `!6m5!${TRAFFIC}`;

describe("getDirectionsUrl", () => {
  it("builds a query-only marker for each waypoint", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" } });
    expect(url.startsWith("https://www.google.com/maps/preview/directions?")).toBe(true);
    expect(pbOf(url)).toBe(`!1m2!1sA!6e0!1m2!1sB!6e0${TRAFFIC_ONLY}`);
  });

  it("includes coordinates when provided", () => {
    const url = getDirectionsUrl({
      origin: { query: "A", coordinates: { latitude: 1.5, longitude: 2.5 } },
      destination: { query: "B" },
    });
    expect(pbOf(url)).toBe(`!1m5!1sA!3m2!3d1.5!4d2.5!6e0!1m2!1sB!6e0${TRAFFIC_ONLY}`);
  });

  it("inserts intermediate waypoints in order", () => {
    const url = getDirectionsUrl({
      origin: { query: "A" },
      destination: { query: "D" },
      waypoints: [{ query: "B" }, { query: "C" }],
    });
    expect(pbOf(url)).toBe(`!1m2!1sA!6e0!1m2!1sB!6e0!1m2!1sC!6e0!1m2!1sD!6e0${TRAFFIC_ONLY}`);
  });

  it("includes a feature id when provided", () => {
    const url = getDirectionsUrl({
      origin: { query: "A", place_id: "0x1:0x2" },
      destination: { query: "B", place_id: "0x3:0x4", coordinates: { latitude: 1, longitude: 2 } },
    });
    expect(pbOf(url)).toBe(`!1m3!1sA!2s0x1:0x2!6e0!1m6!1sB!2s0x3:0x4!3m2!3d1!4d2!6e0${TRAFFIC_ONLY}`);
  });

  it("derives the query from coordinates when no query is given", () => {
    const url = getDirectionsUrl({
      origin: { coordinates: { latitude: 1.5, longitude: 2.5 } },
      destination: { query: "B" },
    });
    expect(pbOf(url)).toBe(`!1m5!1s1.5,2.5!3m2!3d1.5!4d2.5!6e0!1m2!1sB!6e0${TRAFFIC_ONLY}`);
  });

  it("strips the field delimiter from user queries", () => {
    const url = getDirectionsUrl({ origin: { query: " A!B " }, destination: { query: "B" } });
    expect(pbOf(url)).toBe(`!1m2!1sA B!6e0!1m2!1sB!6e0${TRAFFIC_ONLY}`);
  });

  it("always includes the traffic-aware routing block", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" } });
    expect(pbOf(url)).toContain(TRAFFIC);
    expect(pbOf(url)?.endsWith("!6m5!2m4!5m1!6e2!20e3!39b1")).toBe(true);
  });

  it("appends the geometry flag when requested", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" }, geometry: true });
    expect(pbOf(url)).toBe(`!1m2!1sA!6e0!1m2!1sB!6e0!6m6!${TRAFFIC}!14b1`);
  });

  it("appends the travel mode options block when requested", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" }, travelMode: "two_wheeler" });
    expect(pbOf(url)).toBe(`!1m2!1sA!6e0!1m2!1sB!6e0!6m12!${TRAFFIC}!20m6!1e9!2e3!5e2!6b1!8b1!14b1`);
  });

  it("maps bicycling to the cycling enum (1), not transit (3)", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" }, travelMode: "bicycling" });
    expect(pbOf(url)).toContain("!20m6!1e1!2e3!5e2!6b1!8b1!14b1");
  });

  it("appends a departure-time block inside the feature block", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" }, departureTime: 1800000000 });
    expect(pbOf(url)).toBe(`!1m2!1sA!6e0!1m2!1sB!6e0!6m9!${TRAFFIC}!19m3!1e0!2e2!3j1800000000`);
  });

  it("appends an arrival-time block with the arrive-by enum", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" }, arrivalTime: 1800000000 });
    expect(pbOf(url)).toBe(`!1m2!1sA!6e0!1m2!1sB!6e0!6m9!${TRAFFIC}!19m3!1e1!2e2!3j1800000000`);
  });

  it("combines the time block with the travel mode block", () => {
    const url = getDirectionsUrl({
      origin: { query: "A" },
      destination: { query: "B" },
      departureTime: 1800000000,
      travelMode: "two_wheeler",
    });
    expect(pbOf(url)).toBe(`!1m2!1sA!6e0!1m2!1sB!6e0!6m16!${TRAFFIC}!19m3!1e0!2e2!3j1800000000!20m6!1e9!2e3!5e2!6b1!8b1!14b1`);
  });

  it("floors a fractional time to whole seconds", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" }, departureTime: 1800000000.9 });
    expect(pbOf(url)).toContain("3j1800000000");
  });

  it("omits the travel mode block when not requested", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" } });
    expect(pbOf(url)).not.toContain("20m6");
  });

  it("defaults language and region", () => {
    const url = new URL(getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" } }));
    expect(url.searchParams.get("hl")).toBe("en");
    expect(url.searchParams.get("gl")).toBe("us");
    expect(url.searchParams.get("authuser")).toBe("0");
  });

  it("honours explicit language and region", () => {
    const url = new URL(getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" }, language: "fr", region: "lk" }));
    expect(url.searchParams.get("hl")).toBe("fr");
    expect(url.searchParams.get("gl")).toBe("lk");
  });
});
