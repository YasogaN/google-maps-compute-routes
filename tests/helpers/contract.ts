import { getPath } from "../../src/sharedParser.js";

/**
 * Helpers for detecting changes in the raw directions response shape.
 *
 * The Google Maps endpoint is undocumented and can change without notice. The
 * live suite compares the observed structure against the structural
 * assumptions the parser relies on, so a change in the response surfaces as a
 * failing (scheduled) test instead of silent breakage.
 */

/**
 * Return violations of the structural assumptions `directionsParser` relies on.
 *
 * @param data The raw JSON-parsed directions response.
 * @returns A list of human-readable problems (empty when the contract holds).
 */
export function contractViolations(data: unknown): string[] {
  const problems: string[] = [];

  const routes = getPath(data, [0, 1]);
  if (!Array.isArray(routes)) return ["routes node is not an array"];
  if (routes.length === 0) return ["no routes returned"];

  let parseableSteps = 0;

  routes.forEach((route, index) => {
    const summary = getPath(route, [0]);
    if (!Array.isArray(summary)) {
      problems.push(`route ${index} summary is not an array`);
      return;
    }
    if (typeof summary[1] !== "string") problems.push(`route ${index} summary text is not a string`);
    if (!Array.isArray(summary[2]) || typeof summary[2][0] !== "number") {
      problems.push(`route ${index} distance block is missing`);
    }
    if (!Array.isArray(summary[3]) || typeof summary[3][0] !== "number") {
      problems.push(`route ${index} duration block is missing`);
    }

    // Some routes (e.g. transit) expose a different leg shape; the parser treats
    // a non-array steps node as an empty step list, so it is not a violation.
    const legs = getPath(route, [1, 0, 1]);
    if (!Array.isArray(legs)) return;

    for (const leg of legs) {
      const steps = getPath(leg, [1]);
      if (!Array.isArray(steps)) continue;
      for (const step of steps) {
        const html = getPath(step, [0, 1]);
        if (typeof html !== "string" || !html.startsWith("<step")) {
          problems.push(`route ${index} step instructions are malformed`);
        } else {
          parseableSteps += 1;
        }
      }
    }
  });

  if (parseableSteps === 0) problems.push("no parseable steps returned");

  return problems;
}
