import type { RouteLocation } from "./types.js";

/**
 * Request headers for a Chrome top-level navigation to Maps.
 *
 * The session warm-up is a document load, so it carries the navigation
 * `Sec-Fetch-*` triple (and the `document` accept list), not the fetch forms the
 * data requests use.
 */
export function navigationHeaders(): Record<string, string> {
    return {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
    };
}

/**
 * Request headers for the same-origin XHR the Maps page makes to the directions
 * endpoint, with the `Referer` of the directions page it appears to come from.
 *
 * @param referer The directions page URL to send as `Referer`.
 */
export function fetchHeaders(referer: string): Record<string, string> {
    return {
        "Accept": "*/*",
        "Referer": referer,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    };
}

/**
 * Build the `Referer` of the directions page a request appears to originate
 * from, in the same path form this library accepts
 * (`https://www.google.com/maps/dir/Origin/Waypoint/Destination/`).
 *
 * @param origin      The origin waypoint.
 * @param waypoints   The intermediate waypoints, in order.
 * @param destination The destination waypoint.
 * @returns The directions page URL.
 */
export function buildReferer(origin: RouteLocation, waypoints: RouteLocation[], destination: RouteLocation): string {
    const segments = [origin, ...waypoints, destination].map(refererSegment);
    return `https://www.google.com/maps/dir/${segments.join("/")}/`;
}

/**
 * Encode a waypoint the way Maps writes it in a URL: spaces become `+`, commas
 * stay literal, everything else is percent-encoded.
 */
function refererSegment(location: RouteLocation): string {
    const value = location.query ?? `${location.coordinates?.latitude},${location.coordinates?.longitude}`;
    return encodeURIComponent(value).replace(/%20/g, "+").replace(/%2C/g, ",");
}
