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
"legs": [
    {
        "distance": { "meters": "Distance in meters", "text": "Human readable distance" },
        "duration": { "seconds": "Duration in seconds", "text": "Human readable duration" },
        "duration_in_traffic": { "seconds": "Seconds", "text": "Text" } || null,
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

The above format is self-explanatory. `duration_in_traffic` and `duration_range`
are populated for driving-style routes; transit-style alternatives may omit
them and return `null`.

`overview_path` is an approximate path derived from the step boundaries: one
coordinate per step (its `start_location`) followed by the destination. It is a
simplified skeleton, not a dense encoded polyline, because the endpoint does not
return one. When `waypoints` are supplied each stopover adds an extra leg and
its own steps to the path.

# Reporting Issues

If you find any mismatches, irregularities, or other issues with the API documentation or functionality, please help us improve by creating an issue.

You can submit an issue by clicking the "New Issue" button in the repository's [Issues tab](https://github.com/YasogaN/google-maps-compute-routes/issues).

When submitting an issue, kindly include the following details:
+ A clear description of the problem.
+ The origin and destination used.
+ Steps to reproduce the issue.
+ Any relevant logs, error messages, or screenshots (if applicable).
