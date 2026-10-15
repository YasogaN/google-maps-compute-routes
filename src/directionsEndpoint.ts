import type { RouteLocation } from "./types.js";

export interface DirectionsUrl {
    origin: RouteLocation;
    destination: RouteLocation;
    language?: string;
    region?: string;
}

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
 * @param options             - The request components.
 * @param options.origin      - Origin waypoint.
 * @param options.destination - Destination waypoint.
 * @param options.language    - Response language (`hl`), defaults to `en`.
 * @param options.region      - Region bias (`gl`), defaults to `us`.
 * @returns The fully encoded directions endpoint URL.
 */
export default function getDirectionsUrl({ origin, destination, language = "en", region = "us" }: DirectionsUrl): string {
    const pb = `!${buildLocation(origin)}!${buildLocation(destination)}`;
    const params = new URLSearchParams({
        authuser: "0",
        hl: language,
        gl: region,
        pb,
    });
    return `https://www.google.com/maps/preview/directions?${params.toString()}`;
}
