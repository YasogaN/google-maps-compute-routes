import type { Coordinates } from "./types.js";

/**
 * Encode a single signed delta using the Google encoded-polyline algorithm.
 *
 * @param value The signed delta to encode.
 * @returns The encoded chunk.
 */
function encodeValue(value: number): string {
    let remaining = value < 0 ? ~(value << 1) : value << 1;
    let encoded = "";
    while (remaining >= 0x20) {
        encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
        remaining >>= 5;
    }
    encoded += String.fromCharCode(remaining + 63);
    return encoded;
}

/**
 * Encode coordinates using the Google encoded-polyline algorithm.
 *
 * @param coordinates The coordinates to encode.
 * @returns The encoded polyline string.
 */
export function encodePolyline(coordinates: Coordinates[]): string {
    let previousLatitude = 0;
    let previousLongitude = 0;
    let encoded = "";

    for (const { latitude, longitude } of coordinates) {
        const latitudeE5 = Math.round(latitude * 1e5);
        const longitudeE5 = Math.round(longitude * 1e5);
        encoded += encodeValue(latitudeE5 - previousLatitude);
        encoded += encodeValue(longitudeE5 - previousLongitude);
        previousLatitude = latitudeE5;
        previousLongitude = longitudeE5;
    }

    return encoded;
}

/**
 * Decode a Google encoded polyline into coordinates.
 *
 * @param encoded The encoded polyline string.
 * @returns The decoded coordinates (empty when the input is empty).
 */
export function decodePolyline(encoded: string): Coordinates[] {
    const coordinates: Coordinates[] = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        latitude += result & 1 ? ~(result >> 1) : result >> 1;

        result = 0;
        shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        longitude += result & 1 ? ~(result >> 1) : result >> 1;

        coordinates.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
    }

    return coordinates;
}

/** Mean Earth radius in metres. */
const EARTH_RADIUS_M = 6371008.8;

/**
 * Great-circle distance between two coordinates, in metres.
 *
 * @param a The first coordinate.
 * @param b The second coordinate.
 * @returns The distance in metres.
 */
export function metersBetween(a: Coordinates, b: Coordinates): number {
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const halfLat = (lat2 - lat1) / 2;
    const halfLng = ((b.longitude - a.longitude) * Math.PI) / 360;
    const h = Math.sin(halfLat) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(halfLng) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Project a coordinate onto a local east/north metre plane centred on `origin`.
 *
 * Accurate at the scale of a route; it is only used to measure distances of a
 * few metres to a few kilometres.
 */
function localMeters(point: Coordinates, origin: Coordinates): { x: number; y: number } {
    const latRad = (origin.latitude * Math.PI) / 180;
    return {
        x: (((point.longitude - origin.longitude) * Math.PI) / 180) * EARTH_RADIUS_M * Math.cos(latRad),
        y: (((point.latitude - origin.latitude) * Math.PI) / 180) * EARTH_RADIUS_M,
    };
}

/**
 * Distance in metres from `point` to the segment `a`-`b`.
 */
function distanceToSegment(point: Coordinates, a: Coordinates, b: Coordinates): number {
    const p = localMeters(point, a);
    const end = localMeters(b, a);
    const lengthSquared = end.x * end.x + end.y * end.y;
    if (lengthSquared === 0) return Math.hypot(p.x, p.y);

    const t = Math.max(0, Math.min(1, (p.x * end.x + p.y * end.y) / lengthSquared));
    return Math.hypot(p.x - t * end.x, p.y - t * end.y);
}

/**
 * Simplify a path with the Douglas-Peucker algorithm.
 *
 * Keeps the endpoints and every point that lies farther than `toleranceMeters`
 * from the chord it would otherwise be dropped onto. Corners survive, and
 * collinear or near-collinear points on a straight are removed, so a densely
 * sampled polyline collapses to a small set of control points that still
 * follows the original shape.
 *
 * @param coordinates    The path to simplify (not mutated).
 * @param toleranceMeters Maximum deviation to allow, in metres. Zero or less disables simplification.
 * @returns The simplified coordinates (a new array).
 */
export function simplifyPolyline(coordinates: Coordinates[], toleranceMeters: number): Coordinates[] {
    if (coordinates.length <= 2 || toleranceMeters <= 0) return coordinates.slice();

    const keep = new Array<boolean>(coordinates.length).fill(false);
    const last = coordinates.length - 1;
    keep[0] = true;
    keep[last] = true;

    // An explicit stack rather than recursion: a long polyline could nest deeply.
    const stack: Array<[number, number]> = [[0, last]];
    while (stack.length > 0) {
        const [first, end] = stack.pop()!;
        let farthest = -1;
        let maxDistance = 0;
        for (let i = first + 1; i < end; i++) {
            const distance = distanceToSegment(coordinates[i]!, coordinates[first]!, coordinates[end]!);
            if (distance > maxDistance) {
                maxDistance = distance;
                farthest = i;
            }
        }
        if (maxDistance > toleranceMeters) {
            keep[farthest] = true;
            stack.push([first, farthest], [farthest, end]);
        }
    }

    return coordinates.filter((_, index) => keep[index]);
}

/**
 * Keep points at least `minMeters` apart along a path.
 *
 * Used to thin a path to a few hundred metres between control points before a
 * routing request: every control point is a stopover, so a very dense one makes
 * Google detour. The first and last points are always kept.
 *
 * @param coordinates The path to thin (not mutated).
 * @param minMeters   Minimum distance between kept points, in metres. Zero or less keeps everything.
 * @returns The thinned coordinates (a new array).
 */
export function decimateByDistance(coordinates: Coordinates[], minMeters: number): Coordinates[] {
    if (coordinates.length <= 2 || minMeters <= 0) return coordinates.slice();

    const kept: Coordinates[] = [coordinates[0]!];
    for (let index = 1; index < coordinates.length; index++) {
        const isLast = index === coordinates.length - 1;
        if (isLast || metersBetween(kept.at(-1)!, coordinates[index]!) >= minMeters) kept.push(coordinates[index]!);
    }
    return kept;
}

/**
 * Insert interpolated points so no segment is longer than `maxSegmentMeters`.
 *
 * A simplified path only pins the route at its control points; Google picks the
 * road in between. Capping the gap keeps that freedom small while still using
 * far fewer stopovers than dense sampling.
 *
 * @param coordinates       The path to subdivide (not mutated).
 * @param maxSegmentMeters  The longest segment to allow, in metres. Zero or less disables subdivision.
 * @returns The subdivided coordinates (a new array).
 */
export function subdividePolyline(coordinates: Coordinates[], maxSegmentMeters: number): Coordinates[] {
    if (coordinates.length < 2 || maxSegmentMeters <= 0) return coordinates.slice();

    const subdivided: Coordinates[] = [coordinates[0]!];
    for (let i = 0; i < coordinates.length - 1; i++) {
        const from = coordinates[i]!;
        const to = coordinates[i + 1]!;
        const parts = Math.max(1, Math.ceil(metersBetween(from, to) / maxSegmentMeters));
        for (let part = 1; part <= parts; part++) {
            const ratio = part / parts;
            subdivided.push({
                latitude: from.latitude + (to.latitude - from.latitude) * ratio,
                longitude: from.longitude + (to.longitude - from.longitude) * ratio,
            });
        }
    }
    return subdivided;
}
