# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-15

### Added

- `computeRoutes()` entrypoint that computes Google Maps routes from an origin/destination pair or a directions URL
- Encoding of origin/destination waypoints into the undocumented `preview/directions` `pb` protobuf-text request parameter
- `directionsParser` that turns the positional response into typed routes, legs and turn-by-turn steps, including traffic-aware durations, the ETA range and the arrival estimate
- Browser-like HTTP client with optional proxy support and a cookie jar
- Vitest test suites: deterministic `tests/unit` and `tests/integration` suites plus network-dependent `tests/live` tests with shared fixtures and builders
- Scheduled live contract detection that checks the undocumented response against the parser's structural assumptions
