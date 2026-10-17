# Endpoint: previewdirections

## Endpoint URL

```ruby
https://www.google.com/maps/preview/directions
```

## Parameters

- `authuser`: Which signed-in Google account to use. Always `0` for anonymous scraping.

- `hl`: Response language (e.g. `en`).

- `gl`: Region bias used for geocoding and routing (e.g. `us`, `lk`).

- `pb`: Protobuffer data describing the origin, destination and client options.

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

A full request adds many optional feature flags from the web client, but none of them are required to obtain routes.

## Waypoints

Intermediate stopovers are encoded as additional `1m<N>` waypoint messages between the origin and destination:

```
!<origin>!<waypoint 1>!<waypoint 2>!<destination>
```

Every stopover splits the route into a separate segment, and the response stores one segment per stopover (see [Response Structure](#response-structure)). A request with no waypoints yields a single segment.

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

Without this message the endpoint returns its default set of driving routes (sometimes with an alternative mode), so set it explicitly for predictable results. Transit (1) and taxi (4) are not available in all regions.

## The `6m` feature block

Every request carries a `6m` feature block. Its first child is the traffic-aware routing block the Maps web client sends:

```
!2m4!5m1!6e2!20e3!39b1
```

Without it a direct trip still returns live traffic, but a trip with intermediate waypoints returns none: the route's traffic equals its typical duration and every leg's traffic block is empty, so the time between waypoints ignores traffic and the departure time. With it, every leg carries its own traffic-aware duration. This module always sends it. The travel-mode and time messages join it, and the block's `m` count is the total number of tokens it holds (5 for the traffic block, plus 4 for a time, plus 7 for a travel mode).

## Departure and arrival time

The endpoint plans from "now" unless a time is selected. When the Maps web client has a departure or an arrival set it adds a `19m3` message to the `6m` feature block:

```
!19m3!1e<mode>!2e2!3j<unix-seconds>
```

- `1e0` - depart at, `1e1` - arrive by.
- `3j` - the timestamp in true Unix seconds.
- The message is a direct child of `6m`, whose `m` count grows by four (the `19m3` token plus its three children).

Without a travel mode the block is `!6m9!2m4!5m1!6e2!20e3!39b1!19m3!1e0!2e2!3j<seconds>`; with a travel mode the three messages share the block, e.g. `!6m16!2m4!5m1!6e2!20e3!39b1!19m3!1e0!2e2!3j<seconds>!20m6!1e0!2e3!5e2!6b1!8b1!14b1`.

This module sets it through the `departure_time` and `arrival_time` options (see [Arguments](../../ReadMe.md#arguments)). The full endpoint comparison is in the [timing map](timing.md).

> The `data=` URL format uses different fields for the same idea (`6e` / `7e2` / `8j`). Those are ignored here: the `preview` endpoint reads `19m3`, not the `data=` fields.

## Geometry

Unlike the public Routes API, this endpoint does **not** return an encoded polyline. The route line is delivered to the browser as vector tiles (`/maps/vt/stream/...2sdirections...`), which use an opaque compressed format.

What the JSON does expose are the position of each step. Each step's viewport (`step[0][7][0][0]`) is a `[distance, longitude, latitude]` triple centred on the point where the step begins, which is chained into an approximate `overview_path` (each step's start plus the destination). This is a simplified skeleton, not a dense polyline.

## Response Structure

The response is JSON with the XSSI guard prefix `)]}'` prepended, and is a positional nested array.

Top-level layout:

- `data[0]` - main payload
- `data[0][0]` - resolved origin
- `data[0][1]` - array of routes
- `data[0][20]` - travel-mode ETA table (`[[mode], available, [seconds, "text"]]`)

Route layout (`data[0][1][i]`):

- `[0]` - summary block: `[code, summary_text, [meters, "text"], [seconds, "text"], ..., traffic]`
- `[1]` - array of legs (one per waypoint interval: 1 for a direct trip, 2 for one stop)
- `[5]` - route tracking id

Leg layout (`data[0][1][i][1][j]`):

- `[0]` - summary block (distance at `[2]`, duration at `[3]`, an optional traffic block at `[10]`)
- `[1]` - array of step groups; each group's `[1]` holds the navigable steps

Step layout (a group's step, e.g. `data[0][1][i][1][j][1][k]`):

- `[0][1]` - HTML instructions, e.g. `<step maneuver='DEPART' meters='136'>Head toward ...</step>`
- `[0][2]` - distance block `[meters, "text", flag]`
- `[0][3]` - duration block `[seconds, "text"]`

The per-leg duration is the time between waypoints. No departure or arrival
clock time is returned for driving; chain the leg durations from a known start
to derive them. See the [timing map](timing.md) for the full picture.

[^1]: Non-ASCII characters and spaces are percent-encoded by the client when the URL is assembled. A literal `!` in a user query is replaced with a space because it would otherwise be parsed as a field delimiter.
