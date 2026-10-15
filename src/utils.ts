import getDirectionsUrl from "./directionsEndpoint.js";
import type { FetchRoutesParams, JsonArray, RouteLocation, Validate } from "./types.js";

/**
 * Validate the scraper input, throwing on invalid values.
 *
 * When a `url` is supplied it must point at a `google.com` host; otherwise both
 * `origin` and `destination` are required. `clean` must always be a boolean.
 *
 * @param options             - The parameters to validate.
 * @param options.url         - Optional Google Maps directions URL.
 * @param options.origin      - Optional origin (required without a URL).
 * @param options.destination - Optional destination (required without a URL).
 * @param options.clean       - Whether to return parsed routes (must be boolean).
 * @throws {Error} If any parameter is invalid.
 */
export function validateParams({ url, origin, destination, clean }: Validate) {
  if (url !== undefined) {
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
    throw new Error("Either a directions URL or both origin and destination are required");
  }

  if (typeof clean !== "boolean") {
    throw new Error(`Invalid value for 'clean': ${clean}`);
  }
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
 * @param options.language    - Response language (`hl`).
 * @param options.region      - Region bias (`gl`).
 * @param options.client      - The HTTP client to use.
 * @returns The raw JSON array response.
 * @throws {Error} On fetch failure or invalid response format.
 */
export async function fetchRoutes({ origin, destination, language, region, client }: FetchRoutesParams): Promise<JsonArray> {
  const apiUrl = getDirectionsUrl({ origin, destination, language, region });
  const response = await client.fetch(apiUrl);

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
