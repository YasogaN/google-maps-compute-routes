import getDirectionsUrl, { TRAVEL_MODE_VALUES } from "./directionsEndpoint.js";
import { buildReferer, fetchHeaders } from "./headers.js";
import { decodePolyline } from "./polyline.js";
import type { Coordinates, FetchRoutesParams, JsonArray, RouteLocation, Validate } from "./types.js";

/**
 * Maximum number of intermediate waypoints the Routes API allows per request.
 */
export const MAX_INTERMEDIATE_WAYPOINTS = 25;

/**
 * Validate the scraper input, throwing on invalid values.
 *
 * When a `polyline` is supplied the path is taken from it and no
 * origin/destination are required. Otherwise, when a `url` is supplied it must
 * point at a `google.com` host, or both `origin` and `destination` must be
 * present. `waypoints`, when present, must be an array, and `clean` must always
 * be a boolean.
 *
 * @param options             - The parameters to validate.
 * @param options.url         - Optional Google Maps directions URL.
 * @param options.origin      - Optional origin (required without a URL).
 * @param options.destination - Optional destination (required without a URL).
 * @param options.waypoints   - Optional intermediate stopover waypoints.
 * @param options.polyline    - Optional encoded polyline or coordinate path.
 * @param options.clean       - Whether to return parsed routes (must be boolean).
 * @throws {Error} If any parameter is invalid.
 */
export function validateParams({ url, origin, destination, waypoints, polyline, travel_mode, departure_time, arrival_time, simplify, max_gap, max_points_per_request, snap_gap, clean }: Validate) {
  if (polyline !== undefined) {
    // The path comes from the polyline, so no URL or waypoints are required.
  } else if (url !== undefined) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }

    // A trailing dot denotes the DNS root (e.g. "www.google.com."), so strip one
    // optional dot to treat fully-qualified hostnames the same as their normal form.
    const host = parsedUrl.hostname.replace(/\.$/, "");
    if (host !== "google.com" && !host.endsWith(".google.com")) {
      throw new Error(`Invalid host: ${host}`);
    }
  } else if (origin === undefined || destination === undefined) {
    throw new Error("Either a directions URL, a polyline, or both origin and destination are required");
  }

  if (waypoints !== undefined && !Array.isArray(waypoints)) {
    throw new Error(`Invalid waypoints: ${String(waypoints)}`);
  }

  if (waypoints !== undefined && waypoints.length > MAX_INTERMEDIATE_WAYPOINTS) {
    throw new Error(`Too many waypoints: ${waypoints.length} exceeds the limit of ${MAX_INTERMEDIATE_WAYPOINTS}`);
  }

  if (travel_mode !== undefined && !(travel_mode in TRAVEL_MODE_VALUES)) {
    throw new Error(`Invalid travel mode: ${travel_mode}`);
  }

  if (departure_time !== undefined && arrival_time !== undefined) {
    throw new Error("Specify either departure_time or arrival_time, not both");
  }

  if (departure_time !== undefined) toUnixSeconds(departure_time, "departure_time");
  if (arrival_time !== undefined) toUnixSeconds(arrival_time, "arrival_time");

  if (simplify !== undefined && (!Number.isFinite(simplify) || simplify < 0)) {
    throw new Error(`Invalid simplify: ${simplify}`);
  }
  if (max_gap !== undefined && (!Number.isFinite(max_gap) || max_gap < 0)) {
    throw new Error(`Invalid max_gap: ${max_gap}`);
  }
  if (max_points_per_request !== undefined && (!Number.isInteger(max_points_per_request) || max_points_per_request < 2)) {
    throw new Error(`Invalid max_points_per_request: ${max_points_per_request}`);
  }
  if (snap_gap !== undefined && (!Number.isFinite(snap_gap) || snap_gap < 0)) {
    throw new Error(`Invalid snap_gap: ${snap_gap}`);
  }

  if (typeof clean !== "boolean") {
    throw new Error(`Invalid value for 'clean': ${clean}`);
  }
}

/**
 * Convert a `Date` or a Unix-seconds number to whole Unix seconds.
 *
 * @param value The `Date` or Unix-seconds value.
 * @param name  Field name used in the error message.
 * @returns Whole Unix seconds.
 * @throws {Error} If the value is not a valid date or number.
 */
export function toUnixSeconds(value: Date | number, name: string): number {
  const millis = value instanceof Date ? value.getTime() : value * 1000;
  if (!Number.isFinite(millis)) {
    throw new Error(`Invalid ${name}: ${String(value)}`);
  }
  return Math.floor(millis / 1000);
}

/**
 * Resolve a polyline input into the list of coordinates defining the path.
 *
 * @param polyline An encoded polyline string or an array of coordinates.
 * @returns The decoded coordinates.
 * @throws {Error} If fewer than two points are provided.
 */
export function parsePolylineInput(polyline: string | Coordinates[]): Coordinates[] {
  const coordinates = typeof polyline === "string" ? decodePolyline(polyline) : polyline;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("A polyline must contain at least two points");
  }
  return coordinates;
}

/**
 * Coerce a user supplied location into a `RouteLocation`.
 *
 * @param location A free-text query or a structured location.
 * @returns The structured location.
 */
export function toRouteLocation(location: string | RouteLocation): RouteLocation {
  if (typeof location === "string") return { query: location };
  return location;
}

/**
 * Extract the origin and destination from a Google Maps directions URL.
 *
 * Supports both path form (`/maps/dir/Origin/Destination/`) and query form
 * (`/maps/dir/?api=1&origin=Origin&destination=Destination`).
 *
 * @param url The directions URL.
 * @returns The decoded origin and destination strings.
 * @throws {Error} If the URL does not contain two waypoints.
 */
export function parseDirectionsUrl(url: string): { origin: string; destination: string } {
  const parsed = new URL(url);
  const match = /\/maps\/dir\/([^/]+)\/([^/]+)/.exec(parsed.pathname);

  const origin = match?.[1] ?? parsed.searchParams.get("origin");
  const destination = match?.[2] ?? parsed.searchParams.get("destination");

  if (!origin || !destination) {
    throw new Error(`Invalid directions URL: ${url}`);
  }

  return {
    origin: decodeURIComponent(origin.replace(/\+/g, " ")),
    destination: decodeURIComponent(destination.replace(/\+/g, " ")),
  };
}

/**
 * Fetch the raw directions response for an origin/destination pair.
 *
 * @param options             - The fetch parameters.
 * @param options.origin      - Origin waypoint.
 * @param options.destination - Destination waypoint.
 * @param options.waypoints   - Intermediate stopover waypoints.
 * @param options.travelMode  - Optional travel mode.
 * @param options.departureTime - Optional departure time (Unix seconds).
 * @param options.arrivalTime - Optional arrival time (Unix seconds).
 * @param options.language    - Response language (`hl`).
 * @param options.region      - Region bias (`gl`).
 * @param options.client      - The HTTP client to use.
 * @param options.limiter     - Rate limiter gating when the request may start.
 * @returns The raw JSON array response.
 * @throws {Error} On fetch failure or invalid response format.
 */
export async function fetchRoutes({ origin, destination, waypoints, travelMode, departureTime, arrivalTime, geometry, language, region, client, limiter }: FetchRoutesParams): Promise<JsonArray> {
  const apiUrl = getDirectionsUrl({ origin, destination, waypoints, travelMode, departureTime, arrivalTime, geometry, language, region });
  const referer = buildReferer(origin, waypoints, destination);
  await limiter.acquire();
  const response = await client.fetch(apiUrl, { headers: fetchHeaders(referer) });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const textData = await response.text();

  const parts = textData.split(")]}'");
  const rawJson = parts.length > 1 ? parts[1] : parts[0];

  if (!rawJson) {
    throw new Error("No valid JSON data found in the response.");
  }

  const data: unknown = JSON.parse(rawJson);
  if (!Array.isArray(data)) {
    throw new Error("Invalid JSON data found in the response.");
  }

  return data as JsonArray;
}
