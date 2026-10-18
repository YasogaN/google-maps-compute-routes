import type { Impit } from "impit";
import chunkPolyline from "./chunk.js";
import directionsParser from "./directionsParser.js";
import { simplifyPolyline, subdividePolyline } from "./polyline.js";
import { cumulativeTiming } from "./timing.js";
import { fetchRoutes } from "./utils.js";
import type { RateLimiter } from "./rateLimiter.js";
import type {
    Coordinates,
    ParsedLeg,
    ParsedRoute,
    ParsedTime,
    ParsedWaypoint,
    TravelMode,
} from "./types.js";

/** Default Douglas-Peucker tolerance, in metres. */
export const DEFAULT_SIMPLIFY_METERS = 10;
/** Default longest segment after subdivision, in metres. */
export const DEFAULT_MAX_GAP_METERS = 100;
/** Points per request. The endpoint accepts 100 (99 legs); 101 returns HTTP 500. */
export const MAX_POINTS_PER_REQUEST = 100;

export interface PolylineRouteParams {
    points: Coordinates[];
    simplify: number;
    maxGap: number;
    maxPointsPerRequest: number;
    travelMode?: TravelMode | undefined;
    departureTime?: number | undefined;
    arrivalTime?: number | undefined;
    language: string;
    region: string;
    client: Impit;
    limiter: RateLimiter;
}

/** An absolute time as Unix seconds plus an ISO 8601 (UTC) rendering. */
function toTime(seconds: number): ParsedTime {
    return { seconds, text: new Date(seconds * 1000).toISOString() };
}

/** The traffic-aware duration when Google gives one, else the static duration. */
function legSeconds(leg: ParsedLeg): number {
    return leg.duration_in_traffic?.seconds ?? leg.duration.seconds;
}

/** Drop consecutive duplicate coordinates so no zero-length leg is sent. */
function dedupe(points: Coordinates[]): Coordinates[] {
    const unique: Coordinates[] = [];
    for (const point of points) {
        const last = unique.at(-1);
        if (!last || last.latitude !== point.latitude || last.longitude !== point.longitude) unique.push(point);
    }
    return unique;
}

function formatDistance(meters: number): string {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} hr ${minutes} min`;
    if (minutes > 0) return `${minutes} min`;
    return `${total} sec`;
}

/**
 * Route one chunk and parse it. The chunk's first point is the origin, its last
 * the destination, and the points in between are waypoints.
 */
async function fetchChunk(
    points: Coordinates[],
    params: PolylineRouteParams,
    times: { departureTime?: number | undefined; arrivalTime?: number | undefined },
): Promise<ParsedRoute> {
    const data = await fetchRoutes({
        origin: { coordinates: points[0]! },
        destination: { coordinates: points.at(-1)! },
        waypoints: points.slice(1, -1).map((coordinates) => ({ coordinates })),
        travelMode: params.travelMode,
        departureTime: times.departureTime,
        arrivalTime: times.arrivalTime,
        language: params.language,
        region: params.region,
        client: params.client,
        limiter: params.limiter,
    });
    const route = directionsParser(data)[0];
    if (!route || route.legs.length === 0) throw new Error("No route found for a polyline chunk");
    return route;
}

interface RoutedChunks {
    legs: ParsedLeg[];
    durations: number[];
    first: ParsedRoute;
    start: number;
}

/**
 * Route every chunk in order, advancing the departure by the running total so
 * each chunk starts when the previous one arrives.
 */
async function routeForward(chunks: Coordinates[][], params: PolylineRouteParams, start: number): Promise<RoutedChunks> {
    const legs: ParsedLeg[] = [];
    const durations: number[] = [];
    let first: ParsedRoute | undefined;
    let cursor = start;

    for (const chunk of chunks) {
        const route = await fetchChunk(chunk, params, { departureTime: cursor });
        first ??= route;
        for (const leg of route.legs) {
            const seconds = legSeconds(leg);
            durations.push(seconds);
            legs.push(leg);
            cursor += seconds;
        }
    }
    return { legs, durations, first: first!, start };
}

/**
 * Route every chunk for an arrival deadline.
 *
 * One backward pass derives each chunk's arrival from the next chunk's
 * departure; then one forward pass re-routes with those departures so the leg
 * times reflect the traffic at the time each leg is driven. The resulting
 * arrival can drift slightly from the requested one.
 */
async function routeBackward(chunks: Coordinates[][], params: PolylineRouteParams, arrival: number): Promise<RoutedChunks> {
    const departures: number[] = new Array<number>(chunks.length);
    let cursor = arrival;
    for (let index = chunks.length - 1; index >= 0; index--) {
        const route = await fetchChunk(chunks[index]!, params, { arrivalTime: cursor });
        const total = route.legs.reduce((sum, leg) => sum + legSeconds(leg), 0);
        departures[index] = cursor - total;
        cursor = departures[index]!;
    }
    return routeForward(chunks, params, departures[0]!);
}

/**
 * Compute a route along a polyline, chunking it when it is longer than one
 * request can take.
 *
 * The polyline is simplified (Douglas-Peucker) and any remaining long segment
 * is subdivided, so a densely sampled path becomes a small set of control
 * points that still follows the road. The control points are then split into
 * request-sized chunks and routed in order, chaining the departure (or, for an
 * arrival deadline, the arrival) so the leg times stay consistent across
 * chunk boundaries.
 *
 * @param params Simplification, chunk size, travel mode, times and HTTP context.
 * @returns One merged route whose `overview_path` is the dense input and whose
 *   `waypoints` carry the timed control points.
 * @throws {Error} If the path has fewer than two distinct points, or a chunk returns no route.
 */
export async function computePolylineRoute(params: PolylineRouteParams): Promise<ParsedRoute> {
    const dense = dedupe(params.points);
    const control = dedupe(subdividePolyline(simplifyPolyline(dense, params.simplify), params.maxGap));
    if (control.length < 2) throw new Error("A polyline must contain at least two distinct points");

    const chunks = chunkPolyline(control, params.maxPointsPerRequest);

    let routed: RoutedChunks;
    let start: number;
    if (params.arrivalTime !== undefined) {
        routed = await routeBackward(chunks, params, params.arrivalTime);
        start = routed.start;
    } else {
        start = params.departureTime ?? Math.floor(Date.now() / 1000);
        routed = await routeForward(chunks, params, start);
    }

    const timings = cumulativeTiming(routed.durations, start);
    const legs: ParsedLeg[] = routed.legs.map((leg, index) => ({
        ...leg,
        departure: toTime(timings[index]!.departure),
        arrival: toTime(timings[index]!.arrival),
    }));

    const waypoints: ParsedWaypoint[] = control.map((coordinates, index) => {
        const arrivalHere = index === 0 ? start : (timings[index - 1]?.arrival ?? start);
        const departureHere = index === control.length - 1 ? timings.at(-1)!.arrival : (timings[index]?.departure ?? start);
        return { coordinates, departure: toTime(departureHere), arrival: toTime(arrivalHere) };
    });

    const distanceMeters = legs.reduce((sum, leg) => sum + leg.distance.meters, 0);
    const durationSeconds = legs.reduce((sum, leg) => sum + leg.duration.seconds, 0);
    const trafficSeconds = routed.durations.reduce((sum, seconds) => sum + seconds, 0);
    const arrivalSeconds = timings.at(-1)!.arrival;

    return {
        route_id: routed.first.route_id,
        summary: routed.first.summary,
        distance: { meters: distanceMeters, text: formatDistance(distanceMeters) },
        duration: { seconds: durationSeconds, text: formatDuration(durationSeconds) },
        duration_in_traffic: trafficSeconds > 0 ? { seconds: trafficSeconds, text: formatDuration(trafficSeconds) } : null,
        duration_range: null,
        arrival: toTime(arrivalSeconds).text,
        overview_path: dense,
        waypoints,
        legs,
    };
}
