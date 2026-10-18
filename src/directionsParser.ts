import { getPath, numberOrZero, stringOrEmpty } from "./sharedParser.js";
import type { Coordinates, ParsedLeg, ParsedRoute, ParsedStep } from "./types.js";

/**
 * Coerce a raw `[lat, lng]` or `[null, null, lat, lng]` node into coordinates.
 *
 * @param value The raw coordinate node.
 * @returns The parsed coordinates, or `null` when the node is malformed.
 */
function parseCoordinates(value: unknown): Coordinates | null {
    if (!Array.isArray(value)) return null;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
        return { latitude: value[0], longitude: value[1] };
    }
    if (typeof value[2] === "number" && typeof value[3] === "number") {
        return { latitude: value[2], longitude: value[3] };
    }
    return null;
}

/**
 * Coerce a step viewport `[distance, longitude, latitude]` into coordinates.
 *
 * The step's viewport is centred on the point where the step begins, so it is
 * used as an approximate start location for the step.
 *
 * @param value The raw viewport node.
 * @returns The parsed coordinates, or `null` when the node is malformed.
 */
function parseViewportLocation(value: unknown): Coordinates | null {
    if (!Array.isArray(value)) return null;
    if (typeof value[1] === "number" && typeof value[2] === "number") {
        return { latitude: value[2], longitude: value[1] };
    }
    return null;
}

/**
 * Build a `{ meters, text }` pair from a positional distance block.
 *
 * @param value The raw block (e.g. `[2726, "2.7 km", 0]`).
 * @returns The parsed distance.
 */
function parseDistance(value: unknown): { meters: number; text: string } {
    return { meters: numberOrZero(getPath(value, [0])), text: stringOrEmpty(getPath(value, [1])) };
}

/**
 * Extract a `{ seconds, text }` pair from a positional duration block.
 *
 * @param value The raw block (e.g. `[495, "8 min"]`).
 * @returns The parsed duration.
 */
function parseDuration(value: unknown): { seconds: number; text: string } {
    return { seconds: numberOrZero(getPath(value, [0])), text: stringOrEmpty(getPath(value, [1])) };
}

/**
 * Parse a single navigation step.
 *
 * @param step The raw step array.
 * @returns The parsed step, or `null` when the entry is malformed.
 */
function parseStep(step: unknown): ParsedStep | null {
    const detail = getPath(step, [0]);
    if (!Array.isArray(detail)) return null;

    const instructions = stringOrEmpty(getPath(detail, [1]));
    const maneuver = /maneuver='([^']*)'/.exec(instructions);

    return {
        instructions,
        maneuver: maneuver?.[1] ?? "",
        distance: parseDistance(getPath(detail, [2])),
        duration: parseDuration(getPath(detail, [3])),
        start_location: parseViewportLocation(getPath(detail, [7, 0, 0])),
    };
}

/**
 * Find where the route ends: the end location of its last step.
 *
 * The route summary's `[7][3]` is the route's bounding box (south-west and
 * north-east corners), not the destination, so the end is read from the final
 * step's viewport instead.
 *
 * @param route The raw route array.
 * @returns The end coordinate, or `null` when no step carries one.
 */
function lastStepEnd(route: unknown): Coordinates | null {
    let end: Coordinates | null = null;
    function walk(node: unknown): void {
        if (!Array.isArray(node)) return;
        const detail = node[0];
        if (Array.isArray(detail) && typeof detail[1] === "string" && detail[1].startsWith("<step")) {
            const coordinates = parseCoordinates(getPath(detail, [7, 1, 1]));
            if (coordinates) end = coordinates;
        }
        for (const child of node) walk(child);
    }
    walk(route);
    return end;
}

/**
 * Collect the navigable steps of a leg.
 *
 * A leg stores its steps as an array of groups, and a group's `[1]` holds the
 * individual step messages with the HTML instructions. A group with no nested
 * list is treated as a step itself so a differently shaped response still
 * yields steps.
 *
 * @param leg The raw leg array.
 * @returns The parsed steps.
 */
function parseSteps(leg: unknown): ParsedStep[] {
    const groups = getPath(leg, [1]);
    if (!Array.isArray(groups)) return [];

    const steps: ParsedStep[] = [];
    for (const group of groups) {
        const nested = getPath(group, [1]);
        const source = Array.isArray(nested) ? nested : [group];
        for (const step of source) {
            const parsed = parseStep(step);
            if (parsed) steps.push(parsed);
        }
    }
    return steps;
}

/**
 * Parse a single leg (the portion of a route between two waypoints).
 *
 * @param leg The raw leg array.
 * @returns The parsed leg, or `null` when the entry is malformed.
 */
function parseLeg(leg: unknown): ParsedLeg | null {
    const summary = getPath(leg, [0]);
    if (!Array.isArray(summary)) return null;

    const traffic = getPath(summary, [10]);
    const trafficSeconds = getPath(traffic, [0, 0]);

    return {
        distance: parseDistance(getPath(summary, [2])),
        duration: parseDuration(getPath(summary, [3])),
        duration_in_traffic: Array.isArray(traffic) && typeof trafficSeconds === "number"
            ? { seconds: trafficSeconds, text: stringOrEmpty(getPath(traffic, [0, 1])) }
            : null,
        departure: null,
        arrival: null,
        steps: parseSteps(leg),
    };
}

/**
 * Collect the route's legs, one per waypoint interval.
 *
 * The route's `[1]` is already the leg list: a direct trip returns one leg, and
 * each intermediate waypoint adds one. Each leg carries its own distance and
 * duration, so the time between waypoints is read here.
 *
 * @param route The raw route array.
 * @returns The parsed legs.
 */
function parseLegs(route: unknown): ParsedLeg[] {
    const legsRaw = getPath(route, [1]);
    if (!Array.isArray(legsRaw)) return [];

    const legs: ParsedLeg[] = [];
    for (const leg of legsRaw) {
        const parsed = parseLeg(leg);
        if (parsed) legs.push(parsed);
    }
    return legs;
}

/**
 * Parse a single route, including its legs, traffic-aware durations and the
 * approximate overview path.
 *
 * @param route The raw route array.
 * @returns The parsed route, or `null` when the entry is malformed.
 */
function parseRoute(route: unknown): ParsedRoute | null {
    const summary = getPath(route, [0]);
    if (!Array.isArray(summary)) return null;

    const traffic = getPath(summary, [10]);
    const range = Array.isArray(traffic) ? getPath(traffic, [4]) : undefined;

    const legs = parseLegs(route);

    const overviewPath: Coordinates[] = [];
    for (const leg of legs) {
        for (const step of leg.steps) {
            if (step.start_location) overviewPath.push(step.start_location);
        }
    }
    const destination = lastStepEnd(route);
    if (destination) overviewPath.push(destination);

    return {
        route_id: stringOrEmpty(getPath(route, [5])),
        summary: stringOrEmpty(getPath(summary, [1])),
        distance: parseDistance(getPath(summary, [2])),
        duration: parseDuration(getPath(summary, [3])),
        duration_in_traffic: Array.isArray(traffic)
            ? { seconds: numberOrZero(getPath(traffic, [0, 0])), text: stringOrEmpty(getPath(traffic, [0, 1])) }
            : null,
        duration_range: Array.isArray(range)
            ? {
                min_seconds: numberOrZero(range[0]),
                max_seconds: numberOrZero(range[1]),
                text: stringOrEmpty(range[2]),
            }
            : null,
        arrival: stringOrEmpty(getPath(route, [22, 8, 0, 0])) || null,
        overview_path: overviewPath,
        waypoints: [],
        legs,
    };
}

/**
 * Parse a raw `preview/directions` response into structured routes.
 *
 * @param data The JSON-parsed response body.
 * @returns An array of parsed routes (invalid entries are skipped).
 */
export default function directionsParser(data: unknown): ParsedRoute[] {
    const routes = getPath(data, [0, 1]);
    if (!Array.isArray(routes)) return [];
    return routes.map(parseRoute).filter((r): r is ParsedRoute => r !== null);
}
