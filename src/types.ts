import type { Impit } from "impit";

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
    steps: ParsedStep[];
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
    language?: string;
    region?: string;
    clean?: boolean;
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
    clean: boolean;
}

export interface FetchRoutesParams {
    origin: RouteLocation;
    destination: RouteLocation;
    waypoints: RouteLocation[];
    travelMode?: TravelMode | undefined;
    language: string;
    region: string;
    client: Impit;
}

export interface ComputeRouteMatrixOptions {
    origins: Array<string | RouteLocation>;
    destinations: Array<string | RouteLocation>;
    travel_mode?: TravelMode;
    language?: string;
    region?: string;
    concurrency?: number;
    proxy?: {
        proxyUrl?: string | undefined;
        ignoreTls?: boolean;
    }
}

export interface MatrixElement {
    origin_index: number;
    destination_index: number;
    status: "OK" | "ERROR";
    distance: { meters: number; text: string } | null;
    duration: { seconds: number; text: string } | null;
    duration_in_traffic: { seconds: number; text: string } | null;
}

export interface MatrixRow {
    elements: MatrixElement[];
}

export interface ComputeRouteMatrixResult {
    origins: RouteLocation[];
    destinations: RouteLocation[];
    rows: MatrixRow[];
}
