# Structure of clean output

The output is an array of Route Objects.

Check [Reporting Issues](#reporting-issues) if you find any issues with this document.

## Route Object

```json
"route_id": "Opaque route tracking id",
"summary": "Human readable route summary",
"distance": {
    "meters": "Distance in meters",
    "text": "Human readable distance"
},
"duration": {
    "seconds": "Duration in seconds, ignoring traffic",
    "text": "Human readable duration"
},
"duration_in_traffic": {
    "seconds": "Duration in seconds, including live traffic",
    "text": "Human readable duration"
} || null,
"duration_range": {
    "min_seconds": "Optimistic ETA in seconds",
    "max_seconds": "Pessimistic ETA in seconds",
    "text": "Human readable ETA range"
} || null,
"arrival": "Predicted arrival time text" || null,
"overview_path": [
    { "latitude": "Latitude", "longitude": "Longitude" }
],
"geometry": [
    { "latitude": "Latitude", "longitude": "Longitude" }
] || null,
"waypoints": [
    {
        "coordinates": { "latitude": "Latitude", "longitude": "Longitude" },
        "departure": { "seconds": "Unix seconds", "text": "ISO 8601 time" } || null,
        "arrival": { "seconds": "Unix seconds", "text": "ISO 8601 time" } || null
    }
],
"legs": [
    {
        "distance": { "meters": "Distance in meters", "text": "Human readable distance" },
        "duration": { "seconds": "Duration in seconds", "text": "Human readable duration" },
        "duration_in_traffic": { "seconds": "Seconds", "text": "Text" } || null,
        "departure": { "seconds": "Unix seconds", "text": "ISO 8601 time" } || null,
        "arrival": { "seconds": "Unix seconds", "text": "ISO 8601 time" } || null,
        "steps": [
            {
                "instructions": "Raw HTML instructions, e.g. <step maneuver='DEPART' ...>",
                "maneuver": "Maneuver name, e.g. DEPART, TURN, ARRIVE",
                "distance": { "meters": "Distance in meters", "text": "Human readable distance" },
                "duration": { "seconds": "Duration in seconds", "text": "Human readable duration" },
                "start_location": { "latitude": "Latitude", "longitude": "Longitude" } || null
            }
        ]
    }
] || []
```

`duration_in_traffic` and `duration_range` are populated for driving-style routes; transit-style alternatives may omit them and return `null`.

`legs` holds one entry per waypoint interval: a direct trip has one leg, and each intermediate waypoint adds one. A leg's `duration` (and `duration_in_traffic`, when Google supplies it) is the time between its two waypoints. The endpoint returns no departure or arrival clock times for driving, so derive them by chaining the leg durations from a known departure — see the [endpoint page](../endpoints/previewdirections.md#per-leg-timing).

For a `polyline` route, `legs[].departure` / `legs[].arrival` carry the chained clock time of each leg, and `waypoints` lists the simplified control points with the same times (the dense input line is in `overview_path`). A non-polyline route returns `waypoints: []` and null leg times.

`overview_path` is the route's line. For a plain request it is an approximate skeleton assembled from each step's `start_location` plus the route's end, because the endpoint only returns a real line when the geometry flag is sent. Pass `geometry: true` to request that line: `geometry` is then populated and `overview_path` is built from it. For a `polyline` request `overview_path` is the caller's dense input instead, and `geometry` holds Google's own road line whenever the `snap` pass ran (the `polyline` path requests the flag itself, so the `geometry` option is ignored there). `geometry` is `null` when no line was requested.

# Reporting Issues

If you find any mismatches, irregularities, or other issues with the API documentation or functionality, please help us improve by creating an issue.

You can submit an issue by clicking the "New Issue" button in the repository's [Issues tab](https://github.com/YasogaN/google-maps-compute-routes/issues).

When submitting an issue, kindly include the following details:
+ A clear description of the problem.
+ The origin and destination used.
+ Steps to reproduce the issue.
+ Any relevant logs, error messages, or screenshots (if applicable).
