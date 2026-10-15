import { describe, expect, it } from "vitest";
import directionsParser from "../../src/directionsParser.js";
import { makeLeg, makeResponse, makeRoute } from "../helpers/directions.js";

const LEG_SUMMARY = [9, null, [1200, "1.2 km", 0], [300, "5 min"], null, null, null, null];

function routeWithSteps(steps: unknown[]): unknown[] {
  return makeRoute({ 1: [[LEG_SUMMARY, [[LEG_SUMMARY, steps]], null, null, []]] });
}

describe("directionsParser", () => {
  it("parses a well-formed response", () => {
    const routes = directionsParser(makeResponse([makeRoute()]));

    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({
      route_id: "route-token",
      summary: "Main St",
      distance: { meters: 1200, text: "1.2 km" },
      duration: { seconds: 300, text: "5 min" },
      duration_in_traffic: { seconds: 330, text: "6 min" },
      duration_range: { min_seconds: 280, max_seconds: 400, text: "5–7 min" },
      arrival: "You should arrive around 10:57 AM.",
      legs: [
        {
          distance: { meters: 1200, text: "1.2 km" },
          duration: { seconds: 300, text: "5 min" },
          duration_in_traffic: null,
          steps: [
            {
              instructions:
                "<step maneuver='DEPART' meters='100'>Head toward <roadlist><road lang='en'>Main St</road></roadlist></step>",
              maneuver: "DEPART",
              distance: { meters: 100, text: "100 m" },
              duration: { seconds: 60, text: "1 min" },
            },
          ],
        },
      ],
    });
  });

  it("returns an empty array for non-array input", () => {
    expect(directionsParser(null)).toEqual([]);
    expect(directionsParser("nope")).toEqual([]);
  });

  it("returns an empty array when routes are missing", () => {
    expect(directionsParser([1, 2])).toEqual([]);
    expect(directionsParser([null, {}])).toEqual([]);
    expect(directionsParser(makeResponse("nope" as unknown as unknown[]))).toEqual([]);
  });

  it("skips entries that are not arrays or lack a summary", () => {
    expect(directionsParser(makeResponse(["bad", makeRoute({ 0: "bad" }), makeRoute()]))).toHaveLength(1);
  });

  it("treats missing traffic and range blocks as null", () => {
    const [route] = directionsParser(makeResponse([makeRoute({ 0: [9, "x", [1, "1 m"], [2, "2 min"]] })]));
    expect(route?.duration_in_traffic).toBeNull();
    expect(route?.duration_range).toBeNull();
  });

  it("ignores a range block that is not an array", () => {
    const traffic = [[330, "6 min"], null, null, null, "bad"];
    const [route] = directionsParser(makeResponse([makeRoute({ 0: [9, "x", [1, "1 m"], [2, "2 min"], null, null, null, null, null, null, traffic] })]));
    expect(route?.duration_in_traffic).toEqual({ seconds: 330, text: "6 min" });
    expect(route?.duration_range).toBeNull();
  });

  it("returns no legs when the legs node is missing or not an array", () => {
    expect(directionsParser(makeResponse([makeRoute({ 1: "bad" })]))[0]?.legs).toEqual([]);
    expect(directionsParser(makeResponse([makeRoute({ 1: [["summary", "bad"]] })]))[0]?.legs).toEqual([]);
  });

  it("skips malformed legs", () => {
    expect(directionsParser(makeResponse([makeRoute({ 1: [[LEG_SUMMARY, ["bad"]]] })]))[0]?.legs).toEqual([]);
    expect(directionsParser(makeResponse([makeRoute({ 1: [[LEG_SUMMARY, [["bad", []]]]] })]))[0]?.legs).toEqual([]);
  });

  it("returns no steps when the steps node is not an array", () => {
    const legs = directionsParser(makeResponse([makeRoute({ 1: [[LEG_SUMMARY, [[LEG_SUMMARY, "bad"]], null, null, []]] })]))[0]?.legs;
    expect(legs?.[0]?.steps).toEqual([]);
  });

  it("skips malformed steps", () => {
    const legs = directionsParser(makeResponse([routeWithSteps(["bad"])]))[0]?.legs;
    expect(legs?.[0]?.steps).toEqual([]);
  });

  it("defaults a missing maneuver to an empty string", () => {
    const step = [[9, "<step>Go</step>", [1, "1 m", 0], [1, "1 sec"]]];
    const parsed = directionsParser(makeResponse([routeWithSteps([step])]))[0]?.legs[0]?.steps[0];
    expect(parsed?.maneuver).toBe("");
  });

  it("defaults missing distance and duration blocks to zero", () => {
    const step = [[9, "<step maneuver='X'>Go</step>"]];
    const parsed = directionsParser(makeResponse([routeWithSteps([step])]))[0]?.legs[0]?.steps[0];
    expect(parsed?.distance).toEqual({ meters: 0, text: "" });
    expect(parsed?.duration).toEqual({ seconds: 0, text: "" });
  });

  it("defaults a missing arrival estimate to null", () => {
    const [route] = directionsParser(makeResponse([makeRoute({ 22: [] })]));
    expect(route?.arrival).toBeNull();
  });

  it("parses a leg produced by the shared builder", () => {
    const legs = directionsParser(makeResponse([makeRoute({ 1: [[LEG_SUMMARY, [makeLeg()], null, null, []]] })]))[0]?.legs;
    expect(legs?.[0]?.steps).toHaveLength(1);
  });

  it("parses a leg with a traffic block", () => {
    const legSummary = [9, null, [1200, "1.2 km", 0], [300, "5 min"], null, null, null, null, null, null, [[330, "6 min"]]];
    const legs = directionsParser(makeResponse([makeRoute({ 1: [[LEG_SUMMARY, [[legSummary, []]], null, null, []]] })]))[0]?.legs;
    expect(legs?.[0]?.duration_in_traffic).toEqual({ seconds: 330, text: "6 min" });
  });
});
