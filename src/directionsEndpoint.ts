import type { RouteLocation, TravelMode } from "./types.js";

export interface DirectionsUrl {
    origin: RouteLocation;
    destination: RouteLocation;
    waypoints?: RouteLocation[];
    travelMode?: TravelMode | undefined;
    departureTime?: number | undefined;
    arrivalTime?: number | undefined;
    language?: string;
    region?: string;
}

/**
 * Internal travel-mode enum used in the `pb` options message.
 *
 * These values match the mode codes the endpoint returns on each route, which
 * differ from the public Routes API enum.
 */
export const TRAVEL_MODE_VALUES: Record<TravelMode, number> = {
    driving: 0,
    walking: 2,
    bicycling: 3,
    two_wheeler: 9,
};

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
export default function getDirectionsUrl({ origin, destination, waypoints = [], travelMode, departureTime, arrivalTime, language = "en", region = "us" }: DirectionsUrl): string {
    let pb = `!${[origin, ...waypoints, destination].map(buildLocation).join("!")}`;

    // Both options live in the `6m` feature block: `19m3` for the time (enum 0
    // is depart at, 1 is arrive by) and `20m6` for the travel mode. The block's
    // `m` count is the total number of tokens it contains, so each child
    // contributes 1 plus its own token count (4 for the time, 7 for the mode).
    const options: string[] = [];
    let count = 0;
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
    if (options.length > 0) {
        pb += `!6m${count}!${options.join("!")}`;
    }

    const params = new URLSearchParams({
        authuser: "0",
        hl: language,
        gl: region,
        pb,
    });
    return `https://www.google.com/maps/preview/directions?${params.toString()}`;
}
