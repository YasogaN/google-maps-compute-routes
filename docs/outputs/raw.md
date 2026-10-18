# Structure of raw output

When `clean` is `false` (the default), the module returns the parsed response body exactly as Google sent it, with the `)]}'` XSSI guard prefix removed.

The body is a deeply nested positional array with no field names, so its meaning comes from index position. See the [endpoint documentation](../endpoints/previewdirections.md#response-structure) for the layout this library relies on.

The most useful positions are:

- `[0][1]` - the array of routes.
- `[0][1][i][0]` - the route summary block (summary text, distance, duration).
- `[0][1][i][1]` - the array of legs, one per waypoint interval (1 for a direct trip).
- `[0][1][i][1][j][0]` - leg `j`'s summary (distance at `[2]`, duration at `[3]`).
- `[0][1][i][1][j][1]` - leg `j`'s step groups; group `k`'s steps are at `[k][1]`.
- `[0][1][i][1][j][1][k][1][m]` - step `m` of group `k` (HTML instructions at `[0][1]`).
- `[0][20]` - the per-travel-mode ETA table.

The leg duration is the time between its two waypoints. See the [endpoint page](../endpoints/previewdirections.md#per-leg-timing) for departure/arrival and per-leg timing.

Because the endpoint is undocumented, this shape can change without notice. Prefer `clean: true` unless you specifically need fields the parser omits.
