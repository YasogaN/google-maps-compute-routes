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

The `pb` value is not a standard protobuf payload. It is Google's compact,
URL-serialised protobuf-text format in which fields are separated by `!` and
each field is `<field number><type><value>`. The type letters used here are:

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

A message's `m` count covers every token it (recursively) contains, so a child
message contributes `1 + its own token count`.

For a request built by this library (`!<origin>!<destination>`):

1. Origin - `1m<N>` message [^1]
    1. `1s` - string: origin query (place name, address or `lat,lng`)
    2. `2s` - string: feature id `Hex String 1:Hex String 2` (optional)
    3. `3m2` - message (2 tokens)
        1. `3d` - double: latitude
        2. `4d` - double: longitude
    4. `6e0` - enum: waypoint marker
2. Destination - `1m<N>` message (same layout as the origin)

A full request adds many optional feature flags from the web client, but none
of them are required to obtain routes.

## Waypoints

Intermediate stopovers are encoded as additional `1m<N>` waypoint messages
between the origin and destination:

```
!<origin>!<waypoint 1>!<waypoint 2>!<destination>
```

Every stopover splits the route into a separate segment, and the response
stores one segment per stopover (see [Response Structure](#response-structure)).
A request with no waypoints yields a single segment.

## Travel mode

When a travel mode is requested, an options message is appended:

```
!6m7!20m6!1e<mode>!2e3!5e2!6b1!8b1!14b1
```

The `<mode>` value is the internal travel-mode enum, which matches the mode code
the endpoint returns on each route:

| Value | Mode |
| ----- | ---- |
| 0 | driving |
| 2 | walking |
| 3 | bicycling |
| 9 | two-wheeler |

Without this message the endpoint returns its default set of driving routes
(sometimes with an alternative mode), so set it explicitly for predictable
results. Transit (1) and taxi (4) are not available in all regions.

## Geometry

Unlike the public Routes API, this endpoint does **not** return an encoded
polyline. The route line is delivered to the browser as vector tiles
(`/maps/vt/stream/...2sdirections...`), which use an opaque compressed format.

What the JSON does expose are the position of each step. Each step's viewport
(`step[0][7][0][0]`) is a `[distance, longitude, latitude]` triple centred on
the point where the step begins, which is chained into an approximate
`overview_path` (each step's start plus the destination). This is a simplified
skeleton, not a dense polyline.

## Response Structure

The response is JSON with the XSSI guard prefix `)]}'` prepended, and is a
positional nested array.

Top-level layout:

- `data[0]` - main payload
- `data[0][0]` - resolved origin
- `data[0][1]` - array of routes
- `data[0][20]` - travel-mode ETA table (`[[mode], available, [seconds, "text"]]`)

Route layout (`data[0][1][i]`):

- `[0]` - summary block: `[code, summary_text, [meters, "text"], [seconds, "text"], ..., traffic]`
- `[1][0][1]` - array of legs
- `[5]` - route tracking id

Leg layout:

- `[0]` - summary block (distance at `[2]`, duration at `[3]`)
- `[1]` - array of steps

Step layout:

- `[0][1]` - HTML instructions, e.g. `<step maneuver='DEPART' meters='136'>Head toward ...</step>`
- `[0][2]` - distance block `[meters, "text", flag]`
- `[0][3]` - duration block `[seconds, "text"]`

[^1]: Non-ASCII characters and spaces are percent-encoded by the client when the
URL is assembled. A literal `!` in a user query is replaced with a space because
it would otherwise be parsed as a field delimiter.
