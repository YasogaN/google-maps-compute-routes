# Structure of matrix output

`computeRouteMatrix()` returns an object describing the origins, the
destinations and a row of elements per origin.

```json
"origins": [
    { "query": "First origin" }
],
"destinations": [
    { "query": "First destination" }
],
"rows": [
    {
        "elements": [
            {
                "origin_index": 0,
                "destination_index": 0,
                "status": "OK" || "ERROR",
                "distance": { "meters": "Distance in meters", "text": "Human readable distance" } || null,
                "duration": { "seconds": "Duration in seconds", "text": "Human readable duration" } || null,
                "duration_in_traffic": { "seconds": "Seconds", "text": "Text" } || null
            }
        ]
    }
]
```

- `origins` and `destinations` are the normalised inputs, in the order supplied.
- `rows` has one entry per origin, and each row's `elements` are ordered by
  `destination_index`.
- Each element is the best route for that pair. `duration_in_traffic` is the
  live ETA; `duration` ignores traffic.
- When a pair fails (network error, no route, or an empty response) its element
  has `status: "ERROR"` and `null` metrics. A single failure does not reject the
  whole matrix.

Because the underlying endpoint is point-to-point, the matrix is computed with
one request per pair. Use `concurrency` to bound the number of in-flight
requests (default `8`).
