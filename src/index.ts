import { createClient } from "./client.js";
import directionsParser from "./directionsParser.js";
import { fetchRoutes, parseDirectionsUrl, parsePolylineInput, toRouteLocation, validateParams } from "./utils.js";
import type { ComputeRoutesOptions, JsonArray, ParsedRoute, RouteLocation } from "./types.js";

export { decodePolyline, encodePolyline } from "./polyline.js";
export { computeRouteMatrix } from "./matrix.js";
export type {
  ComputeRouteMatrixOptions,
  ComputeRouteMatrixResult,
  Coordinates,
  JsonArray,
  MatrixElement,
  MatrixRow,
  ParsedLeg,
  ParsedRoute,
  ParsedStep,
  RouteLocation,
} from "./types.js";

/**
 * Compute Google Maps routes between an origin and a destination.
 *
 * Supply either a Google Maps directions `url`, or explicit `origin` and
 * `destination` values (free-text queries or structured locations).
 *
 * @param options             - Scraper configuration.
 * @param options.url         - Full Google Maps directions URL.
 * @param options.origin      - Origin query or location (used without a URL).
 * @param options.destination - Destination query or location (used without a URL).
 * @param options.waypoints   - Intermediate stopover waypoints.
 * @param options.polyline    - Encoded polyline or coordinate path to evaluate; takes precedence over origin/destination/waypoints.
 * @param options.language    - Response language (`hl`), defaults to `en`.
 * @param options.region      - Region bias (`gl`), defaults to `us`.
 * @param options.clean       - When `true`, return parsed `ParsedRoute` objects.
 * @param options.proxy       - Optional proxy configuration.
 * @param options.proxy.proxyUrl  - Proxy URL string.
 * @param options.proxy.ignoreTls - Bypass TLS errors when using the proxy.
 * @returns An array of raw route data or parsed `ParsedRoute` objects.
 * @throws {Error} If the input is invalid or the request fails.
 */
export async function computeRoutes(
  {
    url,
    origin,
    destination,
    waypoints = [],
    polyline,
    language = "en",
    region = "us",
    clean = false,
    proxy: {
      proxyUrl = undefined,
      ignoreTls = false
    } = {}
  }: ComputeRoutesOptions
): Promise<ParsedRoute[] | JsonArray> {
  try {
    validateParams({ url, origin, destination, waypoints, polyline, clean });

    let originLocation: RouteLocation;
    let destinationLocation: RouteLocation;
    let waypointLocations: RouteLocation[];

    if (polyline !== undefined) {
      const points = parsePolylineInput(polyline);
      originLocation = { coordinates: points[0]! };
      destinationLocation = { coordinates: points[points.length - 1]! };
      waypointLocations = points.slice(1, -1).map((coordinates) => ({ coordinates }));
    } else {
      let originValue = origin;
      let destinationValue = destination;
      if ((originValue === undefined || destinationValue === undefined) && url !== undefined) {
        const parsed = parseDirectionsUrl(url);
        originValue = parsed.origin;
        destinationValue = parsed.destination;
      }

      originLocation = toRouteLocation(originValue as string);
      destinationLocation = toRouteLocation(destinationValue as string);
      waypointLocations = waypoints.map(toRouteLocation);
    }

    const client = createClient({ proxy: { url: proxyUrl, tls: ignoreTls } });

    const data = await fetchRoutes({
      origin: originLocation,
      destination: destinationLocation,
      waypoints: waypointLocations,
      language,
      region,
      client,
    });

    if (clean) {
      return directionsParser(data);
    }

    return data;
  } catch (e) {
    throw new Error(`Scraper Error: ${e instanceof Error ? e.message : e}`);
  }
}
