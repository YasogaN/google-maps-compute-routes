import { describe, expect, it } from "vitest";
import { parseDirectionsUrl, toRouteLocation, validateParams } from "../../src/utils.js";

describe("validateParams", () => {
  it("accepts a google.com directions URL without origin/destination", () => {
    expect(() =>
      validateParams({ url: "https://www.google.com/maps/dir/A/B/", origin: undefined, destination: undefined, clean: false }),
    ).not.toThrow();
  });

  it("accepts a fully-qualified google.com host with a trailing dot", () => {
    expect(() =>
      validateParams({ url: "https://www.google.com./maps/dir/A/B/", origin: undefined, destination: undefined, clean: false }),
    ).not.toThrow();
  });

  it("accepts an origin and destination without a URL", () => {
    expect(() => validateParams({ url: undefined, origin: "A", destination: "B", clean: true })).not.toThrow();
  });

  it("rejects a non-google host", () => {
    expect(() =>
      validateParams({ url: "https://example.com/maps/dir/A/B/", origin: undefined, destination: undefined, clean: false }),
    ).toThrow(/Invalid host/);
  });

  it("rejects a spoofed google.com host", () => {
    expect(() =>
      validateParams({ url: "https://evilgoogle.com/maps/dir/A/B/", origin: undefined, destination: undefined, clean: false }),
    ).toThrow(/Invalid host/);
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      validateParams({ url: "not a url", origin: undefined, destination: undefined, clean: false }),
    ).toThrow(/Invalid URL format/);
  });

  it("requires origin and destination when no URL is given", () => {
    expect(() => validateParams({ url: undefined, origin: "A", destination: undefined, clean: false })).toThrow(
      /origin and destination/,
    );
  });

  it("rejects a non-boolean clean flag", () => {
    expect(() =>
      validateParams({ url: undefined, origin: "A", destination: "B", clean: "yes" as unknown as boolean }),
    ).toThrow(/Invalid value for 'clean'/);
  });
});

describe("parseDirectionsUrl", () => {
  it("extracts waypoints from the path form", () => {
    expect(parseDirectionsUrl("https://www.google.com/maps/dir/Probike+Battaramulla/The+Fab/")).toEqual({
      origin: "Probike Battaramulla",
      destination: "The Fab",
    });
  });

  it("decodes percent-encoded waypoints", () => {
    expect(parseDirectionsUrl("https://www.google.com/maps/dir/New%20York/Boston/")).toEqual({
      origin: "New York",
      destination: "Boston",
    });
  });

  it("extracts waypoints from the query form", () => {
    expect(parseDirectionsUrl("https://www.google.com/maps/dir/?api=1&origin=A&destination=B")).toEqual({
      origin: "A",
      destination: "B",
    });
  });

  it("throws when fewer than two waypoints are present", () => {
    expect(() => parseDirectionsUrl("https://www.google.com/maps/dir/OnlyOne/")).toThrow(/Invalid directions URL/);
  });
});

describe("toRouteLocation", () => {
  it("wraps a string query", () => {
    expect(toRouteLocation("A")).toEqual({ query: "A" });
  });

  it("passes a structured location through", () => {
    expect(toRouteLocation({ query: "A", place_id: "0x1:0x2" })).toEqual({ query: "A", place_id: "0x1:0x2" });
  });
});
