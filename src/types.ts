import type { Impit } from "impit";
import type { RateLimiter } from "./rateLimiter.js";

type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonObject
    | JsonArray;

export type JsonArray = JsonValue[];

interface JsonObject {
    [key: string]: JsonValue;
}

export interface ProxyConfig {
    url: string | undefined,
    tls?: boolean
}

export interface HTTPClient {
    proxy: ProxyConfig
}

export interface Coordinates {
    latitude: number;
    longitude: number;
}

/** An absolute clock time, as Unix seconds with an ISO 8601 (UTC) rendering. */
export interface ParsedTime {
    seconds: number;
    text: string;
}

export interface ParsedStep {
    instructions: string;
    maneuver: string;
    distance: { meters: number; text: string };
    duration: { seconds: number; text: string };
    start_location: Coordinates | null;
}

export interface ParsedLeg {
    distance: { meters: number; text: string };
    duration: { seconds: number; text: string };
    duration_in_traffic: { seconds: number; text: string } | null;
    departure: ParsedTime | null;
    arrival: ParsedTime | null;
    steps: ParsedStep[];
}

/** One waypoint of a routed polyline, with the time the route reaches it. */
export interface ParsedWaypoint {
    coordinates: Coordinates;
    departure: ParsedTime | null;
    arrival: ParsedTime | null;
}

export interface ParsedRoute {
    route_id: string;
    summary: string;
    distance: { meters: number; text: string };
    duration: { seconds: number; text: string };
    duration_in_traffic: { seconds: number; text: string } | null;
    duration_range: { min_seconds: number; max_seconds: number; text: string } | null;
    arrival: string | null;
    overview_path: Coordinates[];
    waypoints: ParsedWaypoint[];
    legs: ParsedLeg[];
}

export interface RouteLocation {
    query?: string;
    place_id?: string;
    coordinates?: Coordinates;
}

export type TravelMode = "driving" | "walking" | "bicycling" | "two_wheeler";

export interface ComputeRoutesOptions {
    url?: string;
    origin?: string | RouteLocation;
    destination?: string | RouteLocation;
    waypoints?: Array<string | RouteLocation>;
    polyline?: string | Coordinates[];
    travel_mode?: TravelMode;
    departure_time?: Date | number;
    arrival_time?: Date | number;
    simplify?: number;
    max_gap?: number;
    max_points_per_request?: number;
    language?: string;
    region?: string;
    clean?: boolean;
    requests_per_second?: number;
    proxy?: {
        proxyUrl?: string | undefined;
        ignoreTls?: boolean;
    }
}

export interface Validate {
    url: string | undefined;
    origin: string | RouteLocation | undefined;
    destination: string | RouteLocation | undefined;
    waypoints?: Array<string | RouteLocation>;
    polyline?: string | Coordinates[] | undefined;
    travel_mode?: TravelMode | undefined;
    departure_time?: Date | number | undefined;
    arrival_time?: Date | number | undefined;
    simplify?: number | undefined;
    max_gap?: number | undefined;
    max_points_per_request?: number | undefined;
    clean: boolean;
}

export interface FetchRoutesParams {
    origin: RouteLocation;
    destination: RouteLocation;
    waypoints: RouteLocation[];
    travelMode?: TravelMode | undefined;
    departureTime?: number | undefined;
    arrivalTime?: number | undefined;
    language: string;
    region: string;
    client: Impit;
    limiter: RateLimiter;
}

export interface ComputeRouteMatrixOptions {
    origins: Array<string | RouteLocation>;
    destinations: Array<string | RouteLocation>;
    travel_mode?: TravelMode;
    departure_time?: Date | number;
    language?: string;
    region?: string;
    concurrency?: number;
    requests_per_second?: number;
    proxy?: {
        proxyUrl?: string | undefined;
        ignoreTls?: boolean;
    }
}

export interface MatrixElement {
    origin_index: number;
    destination_index: number;
    status: "OK" | "ERROR";
    condition: "ROUTE_EXISTS" | "ROUTE_NOT_FOUND";
    distance: { meters: number; text: string } | null;
    duration: { seconds: number; text: string } | null;
    static_duration: { seconds: number; text: string } | null;
}

export interface ComputeRouteMatrixResult {
    origins: RouteLocation[];
    destinations: RouteLocation[];
    elements: MatrixElement[];
}
