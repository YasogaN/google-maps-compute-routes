import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline, metersBetween, simplifyPolyline, subdividePolyline } from "../../src/polyline.js";

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

describe("metersBetween", () => {
  it("measures a degree of latitude as about 111 km", () => {
    expect(metersBetween({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111195, -2);
  });

  it("is zero for the same point", () => {
    expect(metersBetween({ latitude: 6.9, longitude: 79.9 }, { latitude: 6.9, longitude: 79.9 })).toBe(0);
  });
});

describe("simplifyPolyline", () => {
  const collinear = [
    { latitude: 0, longitude: 0 },
    { latitude: 0.001, longitude: 0 },
    { latitude: 0.002, longitude: 0 },
  ];

  it("returns a copy for two points or fewer", () => {
    const two = [
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ];
    const simplified = simplifyPolyline(two, 10);
    expect(simplified).toEqual(two);
    expect(simplified).not.toBe(two);
  });

  it("removes collinear points", () => {
    expect(simplifyPolyline(collinear, 10)).toEqual([collinear[0], collinear[2]]);
  });

  it("keeps a corner", () => {
    const corner = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0 },
      { latitude: 0.001, longitude: 0.001 },
    ];
    expect(simplifyPolyline(corner, 10)).toEqual(corner);
  });

  it("drops a deviation within the tolerance", () => {
    const noisy = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0 },
      { latitude: 0.002, longitude: 0.00002 }, // ~2.2 m off the straight
      { latitude: 0.003, longitude: 0 },
    ];
    expect(simplifyPolyline(noisy, 10)).toEqual([noisy[0], noisy[3]]);
  });

  it("keeps everything when the tolerance is zero", () => {
    expect(simplifyPolyline(collinear, 0)).toEqual(collinear);
  });

  it("handles repeated points without dividing by zero", () => {
    const repeated = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0 },
    ];
    expect(simplifyPolyline(repeated, 10)).toEqual([repeated[0], repeated[2]]);
  });
});

describe("subdividePolyline", () => {
  it("inserts points so no segment exceeds the cap", () => {
    const subdivided = subdividePolyline(
      [
        { latitude: 0, longitude: 0 },
        { latitude: 0.003, longitude: 0 }, // ~334 m
      ],
      100,
    );
    expect(subdivided).toHaveLength(5);
    expect(subdivided[0]).toEqual({ latitude: 0, longitude: 0 });
    expect(subdivided.at(-1)).toEqual({ latitude: 0.003, longitude: 0 });
    expect(subdivided[1]!.latitude).toBeCloseTo(0.00075, 6);
  });

  it("leaves a short segment alone", () => {
    const short = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.0005, longitude: 0 }, // ~56 m
    ];
    expect(subdividePolyline(short, 100)).toEqual(short);
  });

  it("returns a copy for a single point", () => {
    const one = [{ latitude: 1, longitude: 2 }];
    const subdivided = subdividePolyline(one, 100);
    expect(subdivided).toEqual(one);
    expect(subdivided).not.toBe(one);
  });

  it("keeps the original corners", () => {
    const corner = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0 },
      { latitude: 0.001, longitude: 0.001 },
    ];
    const subdivided = subdividePolyline(corner, 100);
    for (const point of corner) expect(subdivided).toContainEqual(point);
  });
});
