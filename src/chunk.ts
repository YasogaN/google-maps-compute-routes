import type { Coordinates } from "./types.js";

/**
 * Split a path into request-sized chunks that overlap by one point.
 *
 * The directions endpoint accepts at most 100 points per request (99 legs);
 * a longer path has to be routed as several requests. Each chunk repeats the
 * previous chunk's last point as its first, so the chunks tile the path with
 * no gap and no duplicated leg: the shared point is the destination of one
 * chunk and the origin of the next.
 *
 * @param coordinates The path to split (not mutated).
 * @param maxPoints   Maximum points per chunk, including both ends (must be at least 2).
 * @returns One coordinate array per chunk, in path order.
 * @throws {Error} If `maxPoints` is not an integer of at least 2.
 */
export default function chunkPolyline(coordinates: Coordinates[], maxPoints: number): Coordinates[][] {
    if (!Number.isInteger(maxPoints) || maxPoints < 2) {
        throw new Error(`Invalid max points per chunk: ${maxPoints}`);
    }
    if (coordinates.length <= maxPoints) return [coordinates.slice()];

    const chunks: Coordinates[][] = [];
    let start = 0;
    while (start < coordinates.length) {
        const end = Math.min(start + maxPoints, coordinates.length);
        chunks.push(coordinates.slice(start, end));
        if (end === coordinates.length) break;
        // Reuse the last point as the next chunk's origin.
        start = end - 1;
    }
    return chunks;
}
