import type { Impit } from "impit";
import { createClient } from "./client.js";
import directionsParser from "./directionsParser.js";
import { fetchRoutes, toRouteLocation } from "./utils.js";
import type {
    ComputeRouteMatrixOptions,
    ComputeRouteMatrixResult,
    MatrixElement,
    RouteLocation,
    TravelMode,
} from "./types.js";

const DEFAULT_CONCURRENCY = 8;

/**
 * Maximum number of elements (origins × destinations) the service allows per
 * request, per the Routes API usage limits.
 */
export const MAX_MATRIX_ELEMENTS = 625;

interface ComputeElementParams {
    origin: RouteLocation;
    destination: RouteLocation;
    originIndex: number;
    destinationIndex: number;
    travelMode: TravelMode | undefined;
    language: string;
    region: string;
    client: Impit;
}

/**
 * Build an element representing a pair with no route.
 *
 * @param originIndex      The row index.
 * @param destinationIndex The column index.
 * @returns An element with a failed status and no metrics.
 */
function errorElement(originIndex: number, destinationIndex: number): MatrixElement {
    return {
        origin_index: originIndex,
        destination_index: destinationIndex,
        status: "ERROR",
        condition: "ROUTE_NOT_FOUND",
        distance: null,
        duration: null,
        static_duration: null,
    };
}

/**
 * Compute a single matrix cell by routing one origin/destination pair.
 *
 * `duration` includes traffic (matching the Routes API element semantics) while
 * `static_duration` ignores it.
 *
 * @param params The routing parameters for the pair.
 * @returns The matrix element, marking failures without throwing.
 */
async function computeElement({
    origin,
    destination,
    originIndex,
    destinationIndex,
    travelMode,
    language,
    region,
    client,
}: ComputeElementParams): Promise<MatrixElement> {
    try {
        const data = await fetchRoutes({ origin, destination, waypoints: [], travelMode, language, region, client });
        const route = directionsParser(data)[0];
        if (!route) return errorElement(originIndex, destinationIndex);
        return {
            origin_index: originIndex,
            destination_index: destinationIndex,
            status: "OK",
            condition: "ROUTE_EXISTS",
            distance: route.distance,
            duration: route.duration_in_traffic ?? route.duration,
            static_duration: route.duration,
        };
    } catch {
        return errorElement(originIndex, destinationIndex);
    }
}

/**
 * Compute a matrix of routes between every origin and destination pair.
 *
 * This mirrors the Routes `computeRouteMatrix` contract: the result is a flat
 * list of elements (one per origin × destination pair) with `ROUTE_EXISTS` or
 * `ROUTE_NOT_FOUND` conditions. The web endpoint is point to point, so the
 * matrix is built by issuing one request per pair with bounded concurrency, and
 * a failed pair yields an `ERROR` element instead of rejecting the whole matrix.
 *
 * @param options              - Matrix configuration.
 * @param options.origins      - Origin queries or locations (rows).
 * @param options.destinations - Destination queries or locations (columns).
 * @param options.travel_mode  - Travel mode; `two_wheeler` is billed at the Enterprise tier.
 * @param options.language     - Response language (`hl`), defaults to `en`.
 * @param options.region       - Region bias (`gl`), defaults to `us`.
 * @param options.concurrency  - Maximum in-flight requests, defaults to `8`.
 * @param options.proxy        - Optional proxy configuration.
 * @returns The origin/destination lists and the flat list of elements.
 * @throws {Error} If no origins/destinations are supplied, concurrency is invalid,
 *   or the pair count exceeds the documented element limit.
 */
export async function computeRouteMatrix({
    origins,
    destinations,
    travel_mode,
    language = "en",
    region = "us",
    concurrency = DEFAULT_CONCURRENCY,
    proxy: {
        proxyUrl = undefined,
        ignoreTls = false,
    } = {},
}: ComputeRouteMatrixOptions): Promise<ComputeRouteMatrixResult> {
    if (!Array.isArray(origins) || origins.length === 0) {
        throw new Error("At least one origin is required");
    }
    if (!Array.isArray(destinations) || destinations.length === 0) {
        throw new Error("At least one destination is required");
    }
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new Error(`Invalid concurrency: ${concurrency}`);
    }

    const originLocations = origins.map(toRouteLocation);
    const destinationLocations = destinations.map(toRouteLocation);

    const pairs: Array<[number, number]> = [];
    for (let originIndex = 0; originIndex < originLocations.length; originIndex++) {
        for (let destinationIndex = 0; destinationIndex < destinationLocations.length; destinationIndex++) {
            pairs.push([originIndex, destinationIndex]);
        }
    }

    if (pairs.length > MAX_MATRIX_ELEMENTS) {
        throw new Error(`Too many elements: ${pairs.length} exceeds the limit of ${MAX_MATRIX_ELEMENTS}`);
    }

    const client = createClient({ proxy: { url: proxyUrl, tls: ignoreTls } });
    const elements: MatrixElement[] = new Array(pairs.length);
    let cursor = 0;

    async function worker(): Promise<void> {
        while (cursor < pairs.length) {
            const index = cursor;
            cursor += 1;
            const [originIndex, destinationIndex] = pairs[index]!;
            elements[index] = await computeElement({
                origin: originLocations[originIndex]!,
                destination: destinationLocations[destinationIndex]!,
                originIndex,
                destinationIndex,
                travelMode: travel_mode,
                language,
                region,
                client,
            });
        }
    }

    const workerCount = Math.min(concurrency, pairs.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return { origins: originLocations, destinations: destinationLocations, elements };
}
