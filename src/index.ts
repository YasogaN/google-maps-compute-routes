import { createClient } from "./client.js";
import directionsParser from "./directionsParser.js";
import { fetchRoutes, parseDirectionsUrl, toRouteLocation, validateParams } from "./utils.js";
import type { ComputeRoutesOptions, JsonArray, ParsedRoute } from "./types.js";

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
    validateParams({ url, origin, destination, clean });

    let originValue = origin;
    let destinationValue = destination;
    if ((originValue === undefined || destinationValue === undefined) && url !== undefined) {
      const parsed = parseDirectionsUrl(url);
      originValue = parsed.origin;
      destinationValue = parsed.destination;
    }

    const originLocation = toRouteLocation(originValue as string);
    const destinationLocation = toRouteLocation(destinationValue as string);

    const client = createClient({ proxy: { url: proxyUrl, tls: ignoreTls } });

    const data = await fetchRoutes({
      origin: originLocation,
      destination: destinationLocation,
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
