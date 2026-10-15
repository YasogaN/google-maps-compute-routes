# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
