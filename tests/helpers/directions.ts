import { vi } from "vitest";

/**
 * Shared builders for directions response fixtures used across the unit,
 * integration and live test suites.
 */

/** Build a single navigation step array. */
export function makeStep(overrides: Record<number, unknown> = {}): unknown[] {
  const detail: unknown[] = [
    9,
    "<step maneuver='DEPART' meters='100'>Head toward <roadlist><road lang='en'>Main St</road></roadlist></step>",
    [100, "100 m", 0],
    [60, "1 min"],
    null,
    null,
    null,
    [
      [[1000, 79.9, 6.9], [0, 0, 0], [1024, 768], 13.1],
      [[null, null, 6.9, 79.9], [null, null, 6.8, 79.8]],
    ],
  ];
  apply(detail, overrides);
  return [detail];
}

/** Build a leg whose `[1]` is the steps array. */
export function makeLeg(overrides: Record<number, unknown> = {}): unknown[] {
  const summary: unknown[] = [
    9,
    null,
    [1200, "1.2 km", 0],
    [300, "5 min"],
    null,
    null,
    null,
    null,
  ];
  const leg: unknown[] = [summary, [makeStep()], null, 1, "tracking"];
  apply(leg, overrides);
  return leg;
}

/** Build a route array shaped like an entry in the response. */
export function makeRoute(overrides: Record<number, unknown> = {}): unknown[] {
  const summary: unknown[] = [
    9,
    "Main St",
    [1200, "1.2 km", 0],
    [300, "5 min"],
    null,
    null,
    null,
    [null, null, null, [null, null, [null, null, 6.8, 79.8], [null, null, 6.9, 79.9]]],
    null,
    null,
    [[330, "6 min"], null, 1, [260, "4 min"], [280, 400, "5–7 min"], [310]],
  ];
  const meta: unknown[] = [];
  meta[8] = [["You should arrive around 10:57 AM.", 1]];

  const route: unknown[] = [];
  route[0] = summary;
  route[1] = [[summary, [makeLeg()], null, null, ["Asia/Colombo", "GMT+5:30"]]];
  route[5] = "route-token";
  route[22] = meta;

  apply(route, overrides);
  return route;
}

/** Build a full parsed directions response wrapping the given routes. */
export function makeResponse(routes: unknown[]): unknown[] {
  const data: unknown[] = [];
  data[0] = [];
  (data[0] as unknown[])[1] = routes;
  return data;
}

function apply(target: unknown[], overrides: Record<number, unknown>): void {
  for (const [index, value] of Object.entries(overrides)) {
    target[Number(index)] = value;
  }
}

export interface FakeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}

export function textResponse(body: string, ok = true): FakeResponse {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    text: async () => body,
  };
}

export function clientOf(...responses: Array<FakeResponse | Error>): { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetch.mockRejectedValueOnce(response);
    else fetch.mockResolvedValueOnce(response);
  }
  return { fetch };
}

export function asClient(client: { fetch: ReturnType<typeof vi.fn> }): never {
  return client as never;
}
