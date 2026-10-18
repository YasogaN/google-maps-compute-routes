# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Documentation

- Folded `docs/endpoints/timing.md` into `docs/endpoints/previewdirections.md` (departure/arrival, via points, geometry, polyline chunking and snap, per-leg timing) and repointed the links

## [1.3.0] - 2026-10-18

### Fixed

- Routed trips (intermediate `waypoints`, including a chunked `polyline`) now return a traffic-aware duration per leg. The request was missing the web client's traffic-aware routing block (`2m4!5m1!6e2!20e3!39b1`), so with waypoints every leg's traffic block was empty and a chosen departure time did not affect the legs
- `travel_mode: "bicycling"` sent the transit enum (`3`) instead of the cycling enum (`1`), so a bicycle request was routed as transit
- `overview_path` was ended with the route summary's `[7][3][2]`, which is the south-west corner of the route's bounding box, not the destination; it now ends at the last step's end coordinate
- `directionsParser` treated an empty route traffic block (`summary[10] = []`) as `{ seconds: 0 }` instead of `null`
- Per-leg traffic-aware durations are rounded to whole minutes by the endpoint, so summing them inflated a dense trace (a 1 h route reported 10 h). A chunked polyline route now takes each chunk's route-level totals and scales the second-resolution leg durations by the chunk's traffic ratio, so per-waypoint times are smooth and sum to the route total

## [1.2.1] - 2026-10-18

### Fixed

- Restored the 100% branch coverage threshold by covering the self-step fallback in `directionsParser` (test-only; no runtime change)

## [1.2.0] - 2026-10-18

### Added

- `departure_time` and `arrival_time` options on `computeRoutes()` (`Date` or Unix seconds, mutually exclusive) that plan the trip for a chosen time. The endpoint returns the traffic-aware duration for that time instead of "now"
- `departure_time` on `computeRouteMatrix()`, applied to every origin/destination pair
- `computeRoutes()` now routes a `polyline` of any length: it is simplified (Douglas-Peucker) and its long segments subdivided, split into chunks of at most 100 points and routed in order, returning one merged route. A departure is chained forward by the running leg totals; an arrival deadline is chained backward then refined with one forward pass
- `simplify`, `max_gap` and `max_points_per_request` options for polyline chunking
- `ParsedRoute.waypoints` (timed control points) and `ParsedLeg.departure` / `ParsedLeg.arrival` (Unix seconds plus ISO 8601 text)
- `ParsedRoute.geometry` (the route line, decoded from `data[0][7]` when the request asks for it with the `14b1` flag)
- Polyline `snap` (default on) and `snap_gap` options. Snapping routes a sparse control set, keeps Google's road line, thins it to 25 m and times that, so an off-centreline polyline traces accurately instead of detouring at every point: a ~250-300 m-spaced OSRM line went from 2.08x to 1.57x in a sparse-road region and stayed at 1.12x in a dense grid

### Fixed

- `directionsParser` read each step group as a leg, so a route reported one "leg" per step group instead of per waypoint; it now reads the leg list from `route[1]` (one leg per waypoint interval) and flattens each leg's step groups into its steps, so a leg's `duration` is the time between its two waypoints

### Documentation

- Added the departure/arrival (`19m3`), via-point, geometry (`14b1`) and per-leg timing details to the [endpoint page](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/endpoints/previewdirections.md)

## [1.1.0] - 2026-10-15

### Added

- `requests_per_second` option on `computeRoutes()` and `computeRouteMatrix()`: requests are paced at one per second by default (adjustable) so a burst such as the matrix fan-out does not trip the endpoint's anti-bot rate limiting
- Session cookie warm-up: each call fetches `https://maps.google.com/` once to collect Google's `NID`, `AEC`, `SEARCH_SAMESITE` and `__Secure-STRP` cookies into the client's cookie jar before any directions request
- Per-request headers: the warm-up is sent as a document navigation and the directions request as a same-origin fetch, each with the matching `Sec-Fetch-*` headers, and the directions request carries a route-specific `Referer`

### Changed

- Updated `impit` from 0.8.2 to 0.14.6 and `tough-cookie` from `^6.0.1` to `^6.0.2`
- The HTTP client now impersonates impit's `chrome151` fingerprint with its matching Chrome 151 user agent (the bare `chrome` alias resolved to Chrome 124)
- Unwrapped the documentation, so each paragraph and list item is a single line instead of being hard-wrapped at around 80 columns

### Fixed

- The client sent a hardcoded Chrome 147 user agent while impersonating an older TLS/HTTP2 profile; the user agent and the impersonated fingerprint now agree

## [1.0.0] - 2026-10-15

### Added

- `computeRoutes()` entrypoint that computes Google Maps routes from an origin/destination pair or a directions URL
- Encoding of origin/destination waypoints into the undocumented `preview/directions` `pb` protobuf-text request parameter
- `directionsParser` that turns the positional response into typed routes, legs and turn-by-turn steps, including traffic-aware durations, the ETA range and the arrival estimate
- Intermediate waypoints/stops via the `waypoints` option; each stopover becomes its own leg
- Route geometry: each step's `start_location` and an approximate `overview_path` (one point per step plus the destination)
- `polyline` input for `computeRoutes()` — pass an encoded polyline or coordinates and get the traffic-aware ETA and directions along that path
- `encodePolyline()` and `decodePolyline()` helpers implementing the Google encoded-polyline algorithm
- `computeRouteMatrix()` for duration/distance ETAs between many origins and destinations, with bounded concurrency and per-pair error handling
- `travel_mode` option (`driving`, `walking`, `bicycling`, `two_wheeler`) for both `computeRoutes()` and `computeRouteMatrix()`
- Matrix output aligned with the Routes API `computeRouteMatrix` contract: a flat element list with `condition`, traffic-aware `duration` and `static_duration`, plus the documented 625 element limit
- Enforced the documented 25 intermediate waypoint limit for `computeRoutes()`
- A [document mapping](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/skus.md) features to the Compute Routes / Compute Route Matrix Essentials, Pro and Enterprise tiers
- Browser-like HTTP client with optional proxy support and a cookie jar
- Vitest test suites: deterministic `tests/unit` and `tests/integration` suites plus network-dependent `tests/live` tests with shared fixtures and builders
- Scheduled live contract detection that checks the undocumented response against the parser's structural assumptions
- Backlink to the sibling [`google-maps-review-scraper`](https://github.com/YasogaN/google-maps-review-scraper) project

### Fixed

- `directionsParser` initially read only the first waypoint segment; it now collects legs from every segment so waypoint routes no longer lose legs
