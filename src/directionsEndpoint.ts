import type { RouteLocation, TravelMode } from "./types.js";

export interface DirectionsUrl {
    origin: RouteLocation;
    destination: RouteLocation;
    waypoints?: RouteLocation[];
    travelMode?: TravelMode | undefined;
    departureTime?: number | undefined;
    arrivalTime?: number | undefined;
    geometry?: boolean | undefined;
    language?: string;
    region?: string;
}

/**
 * Internal travel-mode enum used in the `pb` options message.
 *
 * These values match the mode code the endpoint returns on each route, which
 * differ from the public Routes API enum: `1` is bicycling and `3` is transit
 * (not exposed here), confirmed against the live endpoint.
 */
export const TRAVEL_MODE_VALUES: Record<TravelMode, number> = {
    driving: 0,
    bicycling: 1,
    walking: 2,
    two_wheeler: 9,
};

/**
 * Traffic-aware routing block, sent inside the `6m` feature block.
 *
 * Captured from the Maps web client, which always sends it. Without it the
 * endpoint returns traffic for a direct trip but not for a routed one: a
 * request with waypoints comes back with no live traffic at all, and every
 * leg's traffic block is empty. With it, each leg carries its own traffic-aware
 * duration (computed for the time the vehicle reaches that leg from the chosen
 * departure), so the time between waypoints reflects traffic.
 */
const TRAFFIC_BLOCK = "2m4!5m1!6e2!20e3!39b1";

/**
 * Remove characters that would break the `pb` protobuf-text encoding.
 *
 * `!` is the field delimiter, so a user supplied place name containing one is
 * replaced with a space rather than silently corrupting the request.
 */
function sanitize(value: string): string {
    return value.replace(/!/g, " ").trim();
}

/**
 * Encode a single waypoint into a `pb` location message.
 *
 * The message is a positional protobuf: `1s` query, `2s` feature id,
 * `3m2!3d..!4d..` coordinates and a trailing `6e0` marker. The `m` count is the
 * number of tokens that follow, including those nested inside child messages.
 */
function buildLocation(location: RouteLocation): string {
    const { coordinates, place_id } = location;
    const query = location.query ?? `${coordinates?.latitude},${coordinates?.longitude}`;

    const tokens: string[] = [`1s${sanitize(query)}`];
    if (place_id !== undefined) tokens.push(`2s${sanitize(place_id)}`);
    if (coordinates !== undefined) {
        tokens.push("3m2", `3d${coordinates.latitude}`, `4d${coordinates.longitude}`);
    }
    tokens.push("6e0");

    return `1m${tokens.length}!${tokens.join("!")}`;
}

/**
 * Build the `preview/directions` request URL for an origin/destination pair.
 *
 * Intermediate `waypoints` are encoded as additional repeated waypoint messages
 * between the origin and destination, which splits the route into one leg per
 * stopover.
 *
 * `departureTime` and `arrivalTime` (Unix seconds) select the time the trip is
 * planned for. They are mutually exclusive and are encoded as the `19m3` time
 * message inside the `6m` options block, which is what the Maps web client
 * sends when a departure or arrival is chosen. Without them the endpoint plans
 * from "now".
 *
 * @param options               - The request components.
 * @param options.origin        - Origin waypoint.
 * @param options.destination   - Destination waypoint.
 * @param options.waypoints     - Optional intermediate stopover waypoints.
 * @param options.travelMode    - Optional travel mode (driving/walking/bicycling/two_wheeler).
 * @param options.departureTime - Optional departure time in Unix seconds (`1e0`).
 * @param options.arrivalTime   - Optional arrival time in Unix seconds (`1e1`).
 * @param options.language      - Response language (`hl`), defaults to `en`.
 * @param options.region        - Region bias (`gl`), defaults to `us`.
 * @returns The fully encoded directions endpoint URL.
 */
export default function getDirectionsUrl({ origin, destination, waypoints = [], travelMode, departureTime, arrivalTime, geometry, language = "en", region = "us" }: DirectionsUrl): string {
    let pb = `!${[origin, ...waypoints, destination].map(buildLocation).join("!")}`;

    // The `6m` feature block always carries the traffic-aware routing block, so
    // a routed (waypoint) trip returns per-leg traffic too. The time (`19m3`,
    // enum 0 depart / 1 arrive) and the travel mode (`20m6`) join it. The
    // block's `m` count is the total number of tokens it contains, so each
    // child contributes 1 plus its own token count (5 traffic, 4 time, 7 mode,
    // 1 geometry).
    const options: string[] = [TRAFFIC_BLOCK];
    let count = 5;
    if (departureTime !== undefined) {
        options.push(`19m3!1e0!2e2!3j${Math.floor(departureTime)}`);
        count += 4;
    } else if (arrivalTime !== undefined) {
        options.push(`19m3!1e1!2e2!3j${Math.floor(arrivalTime)}`);
        count += 4;
    }
    if (travelMode !== undefined) {
        options.push(`20m6!1e${TRAVEL_MODE_VALUES[travelMode]}!2e3!5e2!6b1!8b1!14b1`);
        count += 7;
    }
    if (geometry) {
        // `14b1` makes the response include the route line at `data[0][7]`.
        options.push("14b1");
        count += 1;
    }
    pb += `!6m${count}!${options.join("!")}`;

    const params = new URLSearchParams({
        authuser: "0",
        hl: language,
        gl: region,
        pb,
    });
    return `https://www.google.com/maps/preview/directions?${params.toString()}`;
}
