/**
 * Timing helpers for a route: turn per-leg durations into an absolute
 * departure and arrival for each leg, given one known clock time.
 */

/** The departure and arrival of one leg, as Unix seconds. */
export interface LegTiming {
    departure: number;
    arrival: number;
}

/**
 * Chain leg durations forward from a known departure.
 *
 * @param durations Per-leg durations in seconds, in travel order.
 * @param departure The first leg's departure, as Unix seconds.
 * @returns One `{ departure, arrival }` per leg.
 */
export function cumulativeTiming(durations: number[], departure: number): LegTiming[] {
    const timings: LegTiming[] = [];
    let cursor = departure;
    for (const duration of durations) {
        timings.push({ departure: cursor, arrival: cursor + duration });
        cursor += duration;
    }
    return timings;
}

/**
 * Chain leg durations backward from a known arrival.
 *
 * @param durations Per-leg durations in seconds, in travel order.
 * @param arrival   The last leg's arrival, as Unix seconds.
 * @returns One `{ departure, arrival }` per leg, in travel order.
 */
export function backwardTiming(durations: number[], arrival: number): LegTiming[] {
    const timings: LegTiming[] = new Array<LegTiming>(durations.length);
    let cursor = arrival;
    for (let i = durations.length - 1; i >= 0; i--) {
        const departure = cursor - durations[i]!;
        timings[i] = { departure, arrival: cursor };
        cursor = departure;
    }
    return timings;
}
