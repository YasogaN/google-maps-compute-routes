# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Browser-like HTTP client with optional proxy support and a cookie jar
- Vitest test suites: deterministic `tests/unit` and `tests/integration` suites plus network-dependent `tests/live` tests with shared fixtures and builders
- Scheduled live contract detection that checks the undocumented response against the parser's structural assumptions
- Backlink to the sibling [`google-maps-review-scraper`](https://github.com/YasogaN/google-maps-review-scraper) project

### Fixed

- `directionsParser` initially read only the first waypoint segment; it now collects legs from every segment so waypoint routes no longer lose legs
