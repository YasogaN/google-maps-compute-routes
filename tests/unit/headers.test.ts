import { describe, expect, it } from "vitest";
import { buildReferer, fetchHeaders, navigationHeaders } from "../../src/headers.js";

describe("navigationHeaders", () => {
  it("describes a top-level document navigation", () => {
    expect(navigationHeaders()).toMatchObject({
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    });
  });
});

describe("fetchHeaders", () => {
  it("describes a same-origin fetch from the directions page", () => {
    expect(fetchHeaders("https://www.google.com/maps/dir/A/B/")).toMatchObject({
      "Accept": "*/*",
      "Referer": "https://www.google.com/maps/dir/A/B/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    });
  });
});

describe("buildReferer", () => {
  it("builds the directions path from two queries", () => {
    expect(buildReferer({ query: "A" }, [], { query: "B" })).toBe("https://www.google.com/maps/dir/A/B/");
  });

  it("includes intermediate waypoints in order", () => {
    expect(buildReferer({ query: "A" }, [{ query: "B" }, { query: "C" }], { query: "D" })).toBe(
      "https://www.google.com/maps/dir/A/B/C/D/",
    );
  });

  it("falls back to coordinates when there is no query", () => {
    expect(buildReferer({ coordinates: { latitude: 6.5, longitude: 79.9 } }, [], { coordinates: { latitude: 7, longitude: 80 } })).toBe(
      "https://www.google.com/maps/dir/6.5,79.9/7,80/",
    );
  });

  it("encodes spaces as +, keeps commas and escapes the rest", () => {
    expect(buildReferer({ query: "ARCADIA Cafe & Restaurant, Rd" }, [], { query: "B" })).toBe(
      "https://www.google.com/maps/dir/ARCADIA+Cafe+%26+Restaurant,+Rd/B/",
    );
  });
});
