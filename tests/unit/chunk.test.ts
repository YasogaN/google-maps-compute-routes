import { describe, expect, it } from "vitest";
import chunkPolyline from "../../src/chunk.js";
import type { Coordinates } from "../../src/types.js";

function line(count: number): Coordinates[] {
  return Array.from({ length: count }, (_, index) => ({ latitude: index * 0.001, longitude: 0 }));
}

describe("chunkPolyline", () => {
  it("returns a single copy when the path fits", () => {
    const points = line(5);
    const chunks = chunkPolyline(points, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(points);
    expect(chunks[0]).not.toBe(points);
  });

  it("keeps a path of exactly the maximum as one chunk", () => {
    expect(chunkPolyline(line(100), 100)).toHaveLength(1);
  });

  it("overlaps the boundary point when it has to split", () => {
    const points = line(11);
    const chunks = chunkPolyline(points, 10);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(2);
    // the shared point is the first chunk's last point
    expect(chunks[1]![0]).toEqual(chunks[0]!.at(-1));
    expect(chunks[1]!.at(-1)).toEqual(points.at(-1));
  });

  it("tiles a long path with no gaps", () => {
    const points = line(250);
    const chunks = chunkPolyline(points, 100);

    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 52]);
    expect(chunks[1]![0]).toEqual(chunks[0]!.at(-1));
    expect(chunks[2]![0]).toEqual(chunks[1]!.at(-1));

    // Rebuilding from the chunks (dropping each overlap) reproduces the input.
    const rebuilt = [...chunks[0]!];
    for (const chunk of chunks.slice(1)) rebuilt.push(...chunk.slice(1));
    expect(rebuilt).toEqual(points);
  });

  it("rejects an invalid chunk size", () => {
    expect(() => chunkPolyline(line(3), 1)).toThrow(/Invalid max points/);
    expect(() => chunkPolyline(line(3), 0)).toThrow(/Invalid max points/);
    expect(() => chunkPolyline(line(3), 2.5)).toThrow(/Invalid max points/);
  });
});
