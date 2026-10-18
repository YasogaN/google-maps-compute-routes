# Endpoint: previewdirections

## Endpoint URL

```ruby
https://www.google.com/maps/preview/directions
```

## Parameters

- `authuser`: Which signed-in Google account to use. Always `0` for anonymous scraping.

- `hl`: Response language (e.g. `en`).

- `gl`: Region bias used for geocoding and routing (e.g. `us`, `lk`).

- `pb`: Protobuf data describing the origin, destination and client options.

## PB Data Breakdown

The `pb` value is not a standard protobuf payload. It is Google's compact, URL-serialised protobuf-text format in which fields are separated by `!` and each field is `<field number><type><value>`. The type letters used here are:

| Type | Meaning |
| ---- | ------- |
| `m`  | message (value is the number of tokens the message contains) |
| `s`  | string |
| `i`  | integer |
| `d`  | double |
| `f`  | float |
| `b`  | boolean |
| `e`  | enum |
| `j`  | Unix timestamp in seconds |

These payloads can be decoded and inspected with [protobuf-doc](https://github.com/YasogaN/protobuf-doc) (`npx protobuf-doc "<pb string>" md`).

A message's `m` count covers every token it (recursively) contains, so a child message contributes `1 + its own token count`.

For a request built by this library (`!<origin>!<destination>`):

1. Origin - `1m<N>` message [^1]
    1. `1s` - string: origin query (place name, address or `lat,lng`)
    2. `2s` - string: feature id `Hex String 1:Hex String 2` (optional)
    3. `3m2` - message (2 tokens)
        1. `3d` - double: latitude
        2. `4d` - double: longitude
    4. `6e0` - enum: waypoint marker
2. Destination - `1m<N>` message (same layout as the origin)

A full request adds many optional feature flags from the web client, but only the traffic block below is required for a routed trip to carry live traffic.

## Waypoints

Intermediate stopovers are encoded as additional top-level `1m<N>` waypoint messages between the origin and destination:

```
!<origin>!<waypoint 1>!<waypoint 2>!<destination>
```

Every stopover splits the route into its own leg. Up to 100 top-level points are accepted per request (99 legs); 101 returns HTTP 500. Those points are the origin, the destination and the intermediates, so a plain request carries at most 98 waypoints (`MAX_INTERMEDIATE_WAYPOINTS`), and a polyline is chunked at 100 points. The public Routes API's documented limit of 25 intermediate waypoints is a Pro billing trigger on the keyed API, not a limit on this endpoint.

## Via points

A stopover makes Google route to the point and leave it. A **via** is a pass-through: the route is shaped through it but no leg is created. The Maps web client adds one when a route is dragged, as a top-level field-9 message:

```
!9m6!1i0!2m2!3d<lat>!4d<lng>!3s<featureId>!4f<float>
```

Measured against the live endpoint: the same points as vias come back as **one leg**, as stopovers as one leg each. Vias and stopovers return the same distance (the detour comes from the points being off Google's road, not from the stopover), so a via does not make a dense trace accurate.

Vias and stopovers mix: sending the real waypoints as `1m` messages and a path's shaping points as `9m` vias splits the route into one leg per waypoint while still shaping the path through the vias. That is how a "polyline between waypoints" can be requested.

## Travel mode

When a travel mode is requested, a `20m6` message is added to the `6m` feature block:

```
!6m12!2m4!5m1!6e2!20e3!39b1!20m6!1e<mode>!2e3!5e2!6b1!8b1!14b1
```

The `<mode>` value is the internal travel-mode enum, which matches the mode code the endpoint returns on each route:

| Value | Mode |
| ----- | ---- |
| 0 | driving |
| 1 | bicycling |
| 2 | walking |
| 3 | transit (not exposed by this module) |
| 9 | two-wheeler |

Without this message the endpoint returns its default set of driving routes (sometimes with an alternative mode), so set it explicitly for predictable results. Transit and taxi are not available in all regions.

## The `6m` feature block

Every request carries a `6m` feature block. Its first child is the traffic-aware routing block the Maps web client sends:

```
!2m4!5m1!6e2!20e3!39b1
```

Without it a direct trip still returns live traffic, but a trip with intermediate waypoints returns none: the route's traffic equals its typical duration and every leg's traffic block is empty, so the time between waypoints ignores traffic and the departure time. With it, every leg carries its own traffic-aware duration. This module always sends it.

The time (`19m3`), travel mode (`20m6`) and geometry (`14b1`) messages join it, and the block's `m` count is the total number of tokens it holds: 5 for the traffic block, plus 4 for a time, plus 7 for a travel mode, plus 1 for geometry.

## Departure and arrival time

The endpoint plans from "now" unless a time is selected. When the Maps web client has a departure or an arrival set it adds a `19m3` message to the `6m` feature block:

```
!19m3!1e<mode>!2e2!3j<unix-seconds>
```

- `1e0` - depart at, `1e1` - arrive by.
- `2e2` - constant across every captured request; keep it.
- `3j` - the timestamp in true Unix seconds (a round local wall-clock time maps to a non-round UTC value), not local time written as UTC.

Adding it changes the traffic-aware duration and the typical range. Measured on one trip:

| Request | Typical | In traffic | Range |
| ------- | ------- | ---------- | ----- |
| no time (now) | 1305 s | 964 s | 14–23 min |
| depart in 1 h | 1242 s | 1320 s | 16–35 min |
| arrive by tomorrow noon | 1253 s | 1200 s | 14–24 min |

A departure in the past is accepted for driving, unlike the keyed APIs, which reject it outside transit.

This module sets the block through the `departure_time` and `arrival_time` options (see [Arguments](../../ReadMe.md#arguments)); they accept a `Date` or Unix seconds and are mutually exclusive.

> The `data=` URL format uses different fields for the same idea (`6e` / `7e2` / `8j`). Those are ignored here: the `preview` endpoint reads `19m3`, not the `data=` fields.

## Geometry

The route line is at `data[0][7][i]`, index-aligned with the routes, as two parallel arrays of E7 deltas (latitude, then longitude) whose first element is absolute. It is only returned when the request carries the `14b1` flag; this module sets it for its `snap` pass. Without it `data[0][7]` is null and the line is approximated from the step viewports (`step[0][7][0][0]`, a `[distance, longitude, latitude]` triple at the step's start) plus the last step's end.

Tracing a route's own line reproduces it exactly (1.000x) at any spacing, which is what makes snapping work.

## Tracing a polyline

The endpoint has no native "route along this polyline" mode, so a polyline is sent as repeated waypoints and chunked. With a departure set, each chunk's departure is the user's departure plus the summed leg durations of every earlier chunk; an arrival deadline is chained backward from the requested arrival and refined with one forward pass (the final arrival can drift by tens of seconds).

Every point is a stopover, so a dense trace inflates the route. Measured against a real on-road line (OSRM geometry):

| Waypoint spacing | Traced distance vs the on-road line (US / Sri Lanka) |
| ---------------- | ---------------------------------------------------- |
| ~25 m | 1.86x / 3.4x |
| ~250–300 m | 1.12x / 2.1x |
| ~925 m | 1.01x |

The `snap` option (default on) avoids this: it routes a sparse control set (`snap_gap`, default 500 m) with the geometry flag, takes Google's own line, thins it to at least 25 m and times that. The result follows Google's roads, so the per-point detours are gone (a ~250–300 m OSRM line went from 2.08x to 1.57x in a sparse-road region and stayed 1.12x in a dense grid). The residual gap is Google's road network differing from the input line.

## Per-leg timing

The route's `[1]` is the leg list, one leg per waypoint interval: a direct trip is one leg and each stopover adds one. A leg summary holds its distance at `[2]`, its typical duration at `[3]` and its traffic block at `[10]`. Chaining the leg durations from the departure labels each waypoint with a clock time; no absolute clock times are returned for driving.

Per-leg `duration_in_traffic` is rounded to whole minutes, so every short leg on a dense trace reads "1 min" and summing them is meaningless. The leg `duration` is second-resolution, though, and each chunk's route-level figure is one estimate, so a chunked route takes the route-level totals and scales the leg durations by the chunk's traffic ratio.

## Response Structure

The response is JSON with the XSSI guard prefix `)]}'` prepended, and is a positional nested array.

Top-level layout:

- `data[0]` - main payload
- `data[0][0]` - resolved origin
- `data[0][1]` - array of routes
- `data[0][7]` - per-route line, when the `14b1` flag was sent
- `data[0][20]` - travel-mode ETA table (`[[mode], available, [seconds, "text"]]`)

Route layout (`data[0][1][i]`):

- `[0]` - summary block: `[code, summary_text, [meters, "text"], [seconds, "text"], ..., traffic]`
- `[1]` - array of legs (one per waypoint interval)
- `[5]` - route tracking id

Leg layout (`data[0][1][i][1][j]`):

- `[0]` - summary block (distance at `[2]`, duration at `[3]`, an optional traffic block at `[10]`)
- `[1]` - array of step groups; each group's `[1]` holds the navigable steps

Step layout (a group's step, e.g. `data[0][1][i][1][j][1][k]`):

- `[0][1]` - HTML instructions, e.g. `<step maneuver='DEPART' meters='136'>Head toward ...</step>`
- `[0][2]` - distance block `[meters, "text", flag]`
- `[0][3]` - duration block `[seconds, "text"]`

`route[22][8][0][0]`, when present, is a human arrival sentence ("You should arrive around 10:57 AM."), not a structured time.

## Other endpoints

The keyed APIs take the same departure/arrival idea with documented rules: Routes API `computeRoutes` (`departureTime`, `arrivalTime`; `arrivalTime` and past departures are transit-only), Routes API `computeRouteMatrix` (`departureTime`), the legacy Directions API (`departure_time`, `arrival_time`, `traffic_model`), and the Maps JavaScript `DirectionsService` (`drivingOptions` / `transitOptions`). This module uses the keyless endpoint and does not require a key.

[^1]: Non-ASCII characters and spaces are percent-encoded by the client when the URL is assembled. A literal `!` in a user query is replaced with a space because it would otherwise be parsed as a field delimiter.
