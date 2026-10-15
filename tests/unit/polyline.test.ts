import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline } from "../../src/polyline.js";

describe("decodePolyline", () => {
  it("decodes the reference example", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});

describe("encodePolyline", () => {
  it("encodes the reference example", () => {
    expect(
      encodePolyline([
        { latitude: 38.5, longitude: -120.2 },
        { latitude: 40.7, longitude: -120.95 },
        { latitude: 43.252, longitude: -126.453 },
      ]),
    ).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("round-trips coordinates", () => {
    const coordinates = [
      { latitude: 6.91191, longitude: 79.93237 },
      { latitude: 6.90215, longitude: 79.9153 },
      { latitude: -33.8688, longitude: 151.2093 },
    ];
    expect(decodePolyline(encodePolyline(coordinates))).toEqual(coordinates);
  });
});
