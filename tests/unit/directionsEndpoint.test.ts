import { describe, expect, it } from "vitest";
import getDirectionsUrl from "../../src/directionsEndpoint.js";

function pbOf(url: string): string | null {
  return new URL(url).searchParams.get("pb");
}

describe("getDirectionsUrl", () => {
  it("builds a query-only marker for each waypoint", () => {
    const url = getDirectionsUrl({ origin: { query: "A" }, destination: { query: "B" } });
    expect(url.startsWith("https://www.google.com/maps/preview/directions?")).toBe(true);
    expect(pbOf(url)).toBe("!1m2!1sA!6e0!1m2!1sB!6e0");
  });

  it("includes coordinates when provided", () => {
    const url = getDirectionsUrl({
      origin: { query: "A", coordinates: { latitude: 1.5, longitude: 2.5 } },
      destination: { query: "B" },
    });
    expect(pbOf(url)).toBe("!1m5!1sA!3m2!3d1.5!4d2.5!6e0!1m2!1sB!6e0");
  });

  it("includes a feature id when provided", () => {
    const url = getDirectionsUrl({
      origin: { query: "A", place_id: "0x1:0x2" },
      destination: { query: "B", place_id: "0x3:0x4", coordinates: { latitude: 1, longitude: 2 } },
    });
    expect(pbOf(url)).toBe("!1m3!1sA!2s0x1:0x2!6e0!1m6!1sB!2s0x3:0x4!3m2!3d1!4d2!6e0");
  });

  it("derives the query from coordinates when no query is given", () => {
    const url = getDirectionsUrl({
      origin: { coordinates: { latitude: 1.5, longitude: 2.5 } },
      destination: { query: "B" },
    });
    expect(pbOf(url)).toBe("!1m5!1s1.5,2.5!3m2!3d1.5!4d2.5!6e0!1m2!1sB!6e0");
  });

  it("strips the field delimiter from user queries", () => {
    const url = getDirectionsUrl({ origin: { query: " A!B " }, destination: { query: "B" } });
    expect(pbOf(url)).toBe("!1m2!1sA B!6e0!1m2!1sB!6e0");
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
