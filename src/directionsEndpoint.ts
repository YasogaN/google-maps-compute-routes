import type { RouteLocation, TravelMode } from "./types.js";

export interface DirectionsUrl {
    origin: RouteLocation;
    destination: RouteLocation;
    waypoints?: RouteLocation[];
    travelMode?: TravelMode | undefined;
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
 * @param options             - The request components.
 * @param options.origin      - Origin waypoint.
 * @param options.destination - Destination waypoint.
 * @param options.waypoints   - Optional intermediate stopover waypoints.
 * @param options.travelMode  - Optional travel mode (driving/walking/bicycling/two_wheeler).
 * @param options.language    - Response language (`hl`), defaults to `en`.
 * @param options.region      - Region bias (`gl`), defaults to `us`.
 * @returns The fully encoded directions endpoint URL.
 */
export default function getDirectionsUrl({ origin, destination, waypoints = [], travelMode, language = "en", region = "us" }: DirectionsUrl): string {
    let pb = `!${[origin, ...waypoints, destination].map(buildLocation).join("!")}`;

    if (travelMode !== undefined) {
        // Field 6 carries client options; field 20/1 selects the travel mode.
        pb += `!6m7!20m6!1e${TRAVEL_MODE_VALUES[travelMode]}!2e3!5e2!6b1!8b1!14b1`;
    }

    const params = new URLSearchParams({
        authuser: "0",
        hl: language,
        gl: region,
        pb,
    });
    return `https://www.google.com/maps/preview/directions?${params.toString()}`;
}
