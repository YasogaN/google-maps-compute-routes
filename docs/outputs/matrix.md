# Structure of matrix output

`computeRouteMatrix()` returns the normalised origins and destinations plus a flat list of elements, mirroring the Routes API `computeRouteMatrix` stream: one element per origin × destination pair, in origin-major order.

```json
"origins": [
    { "query": "First origin" }
],
"destinations": [
    { "query": "First destination" }
],
"elements": [
    {
        "origin_index": 0,
        "destination_index": 0,
        "status": "OK" || "ERROR",
        "condition": "ROUTE_EXISTS" || "ROUTE_NOT_FOUND",
        "distance": { "meters": "Distance in meters", "text": "Human readable distance" } || null,
        "duration": { "seconds": "Duration in seconds, including traffic", "text": "Human readable duration" } || null,
        "static_duration": { "seconds": "Duration in seconds, ignoring traffic", "text": "Human readable duration" } || null
    }
]
```

- `status` is `"OK"` when the pair was computed and `"ERROR"` when the request failed (network error or empty response). A failed pair never rejects the whole matrix.
- `condition` is `"ROUTE_EXISTS"` when a route was found, otherwise `"ROUTE_NOT_FOUND"` (matching `RouteMatrixElementCondition`).
- `duration` includes live traffic; `static_duration` ignores it.
- `travel_mode: "two_wheeler"` makes each element an Enterprise-tier two-wheeler route.

Because the underlying endpoint is point-to-point, the matrix is computed with one request per pair. Use `concurrency` to bound the number of in-flight requests (default `8`). The pair count must not exceed `MAX_MATRIX_ELEMENTS` (625), which matches the Routes API limit.
