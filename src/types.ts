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
    legs: ParsedLeg[];
}

export interface RouteLocation {
    query?: string;
    place_id?: string;
    coordinates?: Coordinates;
}

export interface ComputeRoutesOptions {
    url?: string;
    origin?: string | RouteLocation;
    destination?: string | RouteLocation;
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
    clean: boolean;
}

export interface FetchRoutesParams {
    origin: RouteLocation;
    destination: RouteLocation;
    language: string;
    region: string;
    client: Impit;
}
