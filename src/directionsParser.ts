import { getPath, numberOrZero, stringOrEmpty } from "./sharedParser.js";
import type { ParsedLeg, ParsedRoute, ParsedStep } from "./types.js";

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
    };
}

/**
 * Parse a single leg (a portion of a route between two waypoints).
 *
 * @param leg The raw leg array.
 * @returns The parsed leg, or `null` when the entry is malformed.
 */
function parseLeg(leg: unknown): ParsedLeg | null {
    const summary = getPath(leg, [0]);
    if (!Array.isArray(summary)) return null;

    const traffic = getPath(summary, [10]);
    const stepsRaw = getPath(leg, [1]);
    const steps = Array.isArray(stepsRaw)
        ? stepsRaw.map(parseStep).filter((s): s is ParsedStep => s !== null)
        : [];

    return {
        distance: parseDistance(getPath(summary, [2])),
        duration: parseDuration(getPath(summary, [3])),
        duration_in_traffic: Array.isArray(traffic)
            ? { seconds: numberOrZero(getPath(traffic, [0, 0])), text: stringOrEmpty(getPath(traffic, [0, 1])) }
            : null,
        steps,
    };
}

/**
 * Parse a single route, including its legs and traffic-aware durations.
 *
 * @param route The raw route array.
 * @returns The parsed route, or `null` when the entry is malformed.
 */
function parseRoute(route: unknown): ParsedRoute | null {
    const summary = getPath(route, [0]);
    if (!Array.isArray(summary)) return null;

    const traffic = getPath(summary, [10]);
    const range = Array.isArray(traffic) ? getPath(traffic, [4]) : undefined;

    const legsRaw = getPath(route, [1, 0, 1]);
    const legs = Array.isArray(legsRaw)
        ? legsRaw.map(parseLeg).filter((l): l is ParsedLeg => l !== null)
        : [];

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
