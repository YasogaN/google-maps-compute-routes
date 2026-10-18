import { createClient } from "./client.js";
import directionsParser from "./directionsParser.js";
import { computePolylineRoute, DEFAULT_MAX_GAP_METERS, DEFAULT_SIMPLIFY_METERS, MAX_POINTS_PER_REQUEST } from "./polylineRoute.js";
import { RateLimiter } from "./rateLimiter.js";
import { fetchRoutes, parseDirectionsUrl, parsePolylineInput, toRouteLocation, toUnixSeconds, validateParams } from "./utils.js";
import { warmUp } from "./warmup.js";
import type { ComputeRoutesOptions, JsonArray, ParsedRoute } from "./types.js";

export { decodePolyline, encodePolyline } from "./polyline.js";
export { computeRouteMatrix, MAX_MATRIX_ELEMENTS } from "./matrix.js";
export { MAX_INTERMEDIATE_WAYPOINTS } from "./utils.js";
export type {
  ComputeRouteMatrixOptions,
  ComputeRouteMatrixResult,
  Coordinates,
  JsonArray,
  MatrixElement,
  ParsedLeg,
  ParsedRoute,
  ParsedStep,
  ParsedTime,
  ParsedWaypoint,
  RouteLocation,
  TravelMode,
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
 * @param options.polyline    - Encoded polyline or coordinate path to evaluate; takes precedence over origin/destination/waypoints. A long path is simplified, split into request-sized chunks and routed in order, returning one merged route (always parsed, whatever `clean` is).
 * @param options.travel_mode - Optional travel mode (`driving`, `walking`, `bicycling`, `two_wheeler`).
 * @param options.departure_time - Departure time (`Date` or Unix seconds) to plan the trip for.
 * @param options.arrival_time - Arrival time (`Date` or Unix seconds); mutually exclusive with `departure_time`.
 * @param options.simplify    - Polyline Douglas-Peucker tolerance in metres, defaults to `10` (`0` disables).
 * @param options.max_gap     - Longest segment after subdivision, in metres, defaults to `100` (`0` disables).
 * @param options.max_points_per_request - Points per request for a polyline, defaults to `100`.
 * @param options.language    - Response language (`hl`), defaults to `en`.
 * @param options.region      - Region bias (`gl`), defaults to `us`.
 * @param options.clean       - When `true`, return parsed `ParsedRoute` objects.
 * @param options.requests_per_second - Maximum requests to start per second, defaults to `1`.
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
    travel_mode,
    departure_time,
    arrival_time,
    simplify,
    max_gap,
    max_points_per_request,
    language = "en",
    region = "us",
    clean = false,
    requests_per_second = 1,
    proxy: {
      proxyUrl = undefined,
      ignoreTls = false
    } = {}
  }: ComputeRoutesOptions
): Promise<ParsedRoute[] | JsonArray> {
  try {
    validateParams({ url, origin, destination, waypoints, polyline, travel_mode, departure_time, arrival_time, simplify, max_gap, max_points_per_request, clean });

    const limiter = new RateLimiter(requests_per_second);
    const client = createClient({ proxy: { url: proxyUrl, tls: ignoreTls } });

    await warmUp(client, limiter);

    if (polyline !== undefined) {
      const route = await computePolylineRoute({
        points: parsePolylineInput(polyline),
        simplify: simplify ?? DEFAULT_SIMPLIFY_METERS,
        maxGap: max_gap ?? DEFAULT_MAX_GAP_METERS,
        maxPointsPerRequest: max_points_per_request ?? MAX_POINTS_PER_REQUEST,
        travelMode: travel_mode,
        departureTime: departure_time !== undefined ? toUnixSeconds(departure_time, "departure_time") : undefined,
        arrivalTime: arrival_time !== undefined ? toUnixSeconds(arrival_time, "arrival_time") : undefined,
        language,
        region,
        client,
        limiter,
      });
      return [route];
    }

    let originValue = origin;
    let destinationValue = destination;
    if ((originValue === undefined || destinationValue === undefined) && url !== undefined) {
      const parsed = parseDirectionsUrl(url);
      originValue = parsed.origin;
      destinationValue = parsed.destination;
    }

    const data = await fetchRoutes({
      origin: toRouteLocation(originValue as string),
      destination: toRouteLocation(destinationValue as string),
      waypoints: waypoints.map(toRouteLocation),
      travelMode: travel_mode,
      departureTime: departure_time !== undefined ? toUnixSeconds(departure_time, "departure_time") : undefined,
      arrivalTime: arrival_time !== undefined ? toUnixSeconds(arrival_time, "arrival_time") : undefined,
      language,
      region,
      client,
      limiter,
    });

    if (clean) {
      return directionsParser(data);
    }

    return data;
  } catch (e) {
    throw new Error(`Scraper Error: ${e instanceof Error ? e.message : e}`);
  }
}
