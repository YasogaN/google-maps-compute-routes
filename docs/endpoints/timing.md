# Departure, arrival and per-leg timing

Which endpoints can control the departure/arrival time, and where the time
between waypoints can be read. This page is a research map: it records what
each endpoint accepts and returns, what was verified against the live service,
and which one this module can use.

## Summary

- **The keyless `preview/directions` endpoint can plan for a chosen time.** When
  the Maps web client has a departure or arrival selected it adds a `19m3`
  message to the top-level `6m` feature block:

  ```
  !19m3!1e<mode>!2e2!3j<unix-seconds>
  ```

  where `1e0` is **depart at** and `1e1` is **arrive by**, and `3j` is a true
  Unix timestamp in seconds. Without it the endpoint plans from "now".
- This module exposes it as `departure_time` and `arrival_time` on
  `computeRoutes()` (`Date` or Unix seconds; mutually exclusive).
- A keyed Google API also supports it (Routes API `departureTime` /
  `arrivalTime`, legacy Directions API `departure_time` / `arrival_time`), but
  the keyless endpoint already carries what this module needs.
- **The response splits the trip at every waypoint.** `route[1]` is one leg per
  waypoint interval, each with its own distance and duration; that duration is
  the time between the leg's two waypoints. No absolute clock times are
  returned for driving, so chain the leg durations from the departure to label
  each waypoint.

## Endpoint map

| Endpoint | Auth | Departure / arrival control | Per-leg output | Notes |
| -------- | ---- | --------------------------- | -------------- | ----- |
| `www.google.com/maps/preview/directions` (`pb=`) | none (keyless) | `!19m3!1e{0\|1}!2e2!3j<seconds>` in the `!6m` block | `route[1]` = one leg per waypoint: distance, typical duration, optional traffic | What this module uses |
| `www.google.com/maps/dir/<o>/<d>/data=` | none (keyless) | `!6e0` depart / `!6e1` arrive + `!7e2` + `!8j<seconds>` | Route payload in the page state | Needs a browser engine; transit uses it in practice |
| Routes API v2 `computeRoutes` | API key | `departureTime`, `arrivalTime` (RFC3339) | `routes[].legs[]` | `arrivalTime` is transit-only; past departure is transit-only |
| Routes API v2 `computeRouteMatrix` | API key | `departureTime` | Matrix elements (`duration`, `staticDuration`) | Up to 625 elements, 100 for transit / traffic-aware-optimal |
| Directions API (legacy) | API key | `departure_time`, `arrival_time` (Unix seconds) | `routes[].legs[]` | Drives `duration_in_traffic`; transit also accepts `arrival_time` |
| Maps JavaScript `DirectionsService` | API key (client) | `drivingOptions.departureTime`; `transitOptions.departureTime/arrivalTime` | `DirectionsLeg` | Browser-only; not usable from this module |

### Two different time serialisations

The `preview/directions` `pb` and the web `data=` URL are different formats, and
they use different fields for the time:

- `preview` `pb`: `19m3!1e{0|1}!2e2!3j<seconds>`, a direct child of the
  top-level `6m` feature block.
- `data=` URL: `6e0`/`6e1` + `7e2` + `8j<seconds>` inside the route-options
  message.

Sending the `data=` fields to `preview/directions` does nothing: the request is
planned from "now" and the response is unchanged. That is the source of the
earlier belief that the keyless endpoint had no time field.

## The `19m3` time block

Captured from the Maps web client (LibreWolf 158) with three directions requests
for the same trip: a plain one and two with the time set. The only meaningful
difference is the `19m3` message, whose enum and timestamp change:

```
!19m3!1e0!2e2!3j1792264479   depart at
!19m3!1e1!2e2!3j1792261800   arrive by
```

- `1e` is the mode: `0` = depart at, `1` = arrive by.
- `2e2` is constant across every capture; keep it.
- `3j` is Unix seconds. A round local wall-clock time maps to a non-round UTC
  value (e.g. 00:00 in Sri Lanka is `18:30:00Z`), so it is a true epoch, not
  local time written as UTC.

The block lives in the `6m` feature block, whose `m` count is the total number
of tokens it contains. The time message contributes four tokens (`19m3` plus its
three children), so a time-only request uses `6m4` and a request with a travel
mode too uses `6m11`.

### Verified behaviour

Against the live endpoint, adding the block changes the traffic-aware duration
and the typical range (`summary[10][4]`), which is the whole point of choosing a
time:

| Request | Typical | In traffic | Range |
| ------- | ------- | ---------- | ----- |
| no time (now) | 1305 s | 964 s | 14–23 min |
| depart in 1 h | 1242 s | 1320 s | 16–35 min |
| depart tomorrow noon | 1242 s | 1200 s | 16–26 min |
| arrive by tomorrow noon | 1253 s | 1200 s | 14–24 min |

A departure in the past is accepted for driving (a three-day-old timestamp came
back with a route), unlike the keyed APIs, which reject it outside transit.

### The traffic-aware routing block

Every request this module sends also carries the web client's traffic-aware
routing block in the `6m` feature block:

```
!2m4!5m1!6e2!20e3!39b1
```

Without it a direct trip still returns traffic, but a trip with waypoints
returns none: the route's traffic equals its typical duration and every leg's
traffic block is empty. That made the time between waypoints static and ignored
the departure time. With the block, each leg carries its own traffic-aware
duration, computed for the time the vehicle reaches that leg, so chaining the
legs from the departure gives a traffic-aware arrival at each waypoint.

## Tracing a polyline: chunking and the stopover cost

A polyline is sent as repeated waypoint messages, so it is chunked at 100 points per request (the endpoint accepts 100, not the public API's 25). With a departure set, each chunk's departure is the user's departure plus the summed leg durations of every earlier chunk, so the clock advances across chunk boundaries. An arrival deadline is chained backward from the requested arrival and then refined with one forward pass; the final arrival can drift slightly from the requested one.

Every point is a **stopover**: Google routes to it and leaves it. The endpoint has no pass-through ("via") marker — the waypoint enum `6e0`/`6e1`/`6e2` all behave the same — so densely sampled points add detour distance and time. Measured against a real on-road line (OSRM geometry) traced back through the endpoint:

| Waypoint spacing | Traced distance vs the on-road line |
| ---------------- | ----------------------------------- |
| ~25 m (US / Sri Lanka) | 1.86x / 3.4x |
| ~250–300 m | 1.12x / 2.1x |
| ~925 m | 1.01x |

The lesson: do not trace a polyline point-by-point. Simplify with a tolerance and cap the gap so control points are a few hundred metres apart at least. The `simplify` / `max_gap` options do this, but the defaults (10 m / 100 m) keep too many points for an accurate ETA — raise `max_gap` (500 m, say) when the duration matters.

### Snapping the trace to Google's own line

Because tracing a route's own geometry is exact at any spacing, this module can put the polyline on Google's roads first. With `snap` on (the default for a polyline):

1. Thin the path to `snap_gap` metres (default 500) and route it once with the `14b1` geometry flag. This control set is sparse, so Google does not detour.
2. Take the returned line (`data[0][7]`), thin it to at least 25 m — Google's line is often ~10 m apart and a trace that tight zigzags — and route that for the per-leg times.

The timed route then follows Google's roads, so the per-point detours are gone. Measured on a ~250–300 m-spaced OSRM line: 2.08x → 1.57x in a sparse-road region, 1.12x unchanged in a dense grid. The residual gap is Google's road network differing from the input line, which snapping cannot remove.

### Via points (pass-through)

Dragging a route in the Maps web client adds top-level field-9 messages, not stopovers:

```
!9m6!1i0!2m2!3d<lat>!4d<lng>!3s<featureId>!4f<float>
```

They are pass-through: a request with vias comes back as one leg, while the same points as field-1 stopovers come back as one leg each. They do **not** avoid the stopover cost above — measured on the same on-road line, vias and stopovers return the same distance (dense ~1.9x, ~130 m ~1.12x). So a via does not make dense tracing accurate; the density is what matters either way.

The route's real geometry is also available: adding `14b1` to the `6m` feature block makes the response include `data[0][7][i]`, the route line as delta-encoded E7 coordinate arrays (latitude deltas, longitude deltas, first element absolute), index-aligned with the routes. This module sets that flag for its `snap` pass. Without it `data[0][7]` is null, so `overview_path` is approximated from the step viewports instead. Tracing a route's own geometry at any spacing reproduces it exactly (1.000x), which is why the geometry pass exists.

## What the keyed APIs add

The keyless endpoint always routes between two points for a chosen time. The
keyed APIs add the same selection with documented rules and, for transit, an
arrival deadline:

- **Routes API `computeRoutes`** — `departureTime` may be in the past only for
  `TRANSIT`; `arrivalTime` is ignored unless the mode is `TRANSIT`. Transit
  trips are available from 7 days in the past to 100 days in the future.
- **Routes API `computeRouteMatrix`** — `departureTime` is optional and defaults
  to the request time. Transit matrices are capped at 100 elements.
- **Directions API (legacy)** — `departure_time` is a Unix timestamp (or
  `now`). For driving it must be now or in the future and selects the
  traffic-aware `duration_in_traffic`; for transit either `departure_time` or
  `arrival_time` works. `traffic_model` is only valid with a `departure_time`.

## Per-leg timing

The keyless response already splits the trip at every waypoint.

### Response shape

```
route[0]            route summary: distance [2], typical duration [3]
route[0][10]        route traffic block: [0] = [seconds, text], [4] = [min, max, text]
route[1]            legs — one per waypoint interval (direct trip = 1, one stop = 2)
route[1][i][0]      leg summary: distance [2], typical duration [3], traffic [10]
route[1][i][1]      step groups; each group[1] holds the navigable steps
```

`route[1]` being the leg list is confirmed by the numbers: for
`Colombo → Kaduwela → Battaramulla` the two leg summaries read 17.0 km and
9.7 km, which sum to the route's 26.7 km. This matches how [Vela times its
legs](https://github.com/PimpinPumpkin/Vela) (`legs = route[1]`,
`leg[0]` = summary), and how the public Directions API defines a leg.

### What is available

- **Time between waypoints** — `route[1][i][0][3][0]` (seconds) with its text at
  `[3][1]`. This is the value the module exposes per leg.
- **Distance** — `route[1][i][0][2][0]`.
- **Traffic-aware leg time** — `route[1][i][0][10]`, present on every leg when
  the request carries the traffic-aware routing block (below). The endpoint
  returns no leg traffic without it, so a routed trip would show only static
  durations.
- **No clock times for driving.** A scan of a live driving response found no
  departure/arrival clock strings or epoch timestamps tied to the route. Arrival
  is only a human sentence at `route[22][8][0][0]` ("You should arrive around
  10:57 AM."), it is optional, and it is absent on many routes. This module
  parses it into `arrival` when present.
- **Transit is different.** Transit legs carry epoch tuples
  (`[epochSeconds, zone, "h:mm AM", ...]`) for real-time and scheduled calls, in
  a response shape the current parser does not read.

To label each waypoint with a clock time, chain the legs from the chosen
departure: `arrivalAt(leg i) = departureAt(leg i) + legDuration(i)`, where
`departureAt(leg 0)` is the `departure_time` you passed (or "now").

The `clean` output exposes `route[1]` as the `legs` array (one entry per
waypoint interval), each with its own `distance`, `duration` and
`duration_in_traffic`. Its steps come from flattening each leg's step groups.

### Leg traffic is minute-rounded

Every per-leg `duration_in_traffic` is rounded to whole minutes. On a dense trace (a waypoint every 25–30 m) each leg reports "1 min" regardless of length, so summing legs is meaningless — a 1 h route summed to 10 h. The leg `duration` is second-resolution, though, and each chunk's route-level `duration_in_traffic` is one real estimate. A chunked polyline route therefore takes each chunk's route-level totals and scales the leg durations by the chunk's traffic ratio, so the per-waypoint times are smooth and sum to the route total.

## Using it in this module

```ts
const routes = await computeRoutes({
  origin: "Nugegoda",
  destination: "Mount Lavinia",
  region: "lk",
  departure_time: new Date("2026-10-19T12:00:00+05:30"),
  clean: true,
});
// -> one request with !19m3!1e0!2e2!3j<seconds>; legs[0].duration is the
//    traffic-aware time for that chosen departure
```

`arrival_time` uses the arrive-by enum (`1e1`) instead. Setting both throws, and
either accepts a `Date` or a Unix-seconds number. `computeRouteMatrix()` takes
`departure_time` as well and applies it to every origin/destination pair.

## References

- The Maps web client's directions requests (a HAR capture of a plain request
  plus depart-at and arrive-by requests) are the source of the `19m3` field.
- [Vela](https://github.com/PimpinPumpkin/Vela) — keyless Google Maps client;
  its captured `DirectionsPb` template has no `19m3` block (no time was selected
  when it was captured) and records the `data=` time fields as a dead end; its
  `DirectionsParser.kt` documents the leg and geometry indices.
- [Routes API `computeRoutes`](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)
  — `departureTime`, `arrivalTime`.
- [Routes API `computeRouteMatrix`](https://developers.google.com/maps/documentation/routes/compute_route_matrix)
  — element limits and `departureTime`.
- [Routes API: transit route](https://developers.google.com/maps/documentation/routes/transit-route)
  — arrival/departure windows.
- [Directions API (legacy)](https://developers.google.com/maps/documentation/directions/get-directions)
  — `departure_time`, `arrival_time`, `traffic_model`.
- [Maps JavaScript `DirectionsService`](https://developers.google.com/maps/documentation/javascript/directions)
  — `drivingOptions.departureTime`, `transitOptions`.
- [Google Maps URL data options](https://mstickles.wordpress.com/2015/06/12/gmaps-urls-options/)
  — `6e` / `7e` / `8j` field meanings in the `data=` format.
