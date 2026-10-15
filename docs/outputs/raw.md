# Structure of raw output

When `clean` is `false` (the default), the module returns the parsed response
body exactly as Google sent it, with the `)]}'` XSSI guard prefix removed.

The body is a deeply nested positional array with no field names, so its
meaning comes from index position. See the
[endpoint documentation](../endpoints/previewdirections.md#response-structure)
for the layout this library relies on.

The most useful positions are:

- `[0][1]` - the array of routes.
- `[0][1][i][0]` - the route summary block (summary text, distance, duration).
- `[0][1][i][1][0][1]` - the array of legs.
- `[0][1][i][1][0][1][j][1]` - the array of steps for leg `j`.
- `[0][20]` - the per-travel-mode ETA table.

Because the endpoint is undocumented, this shape can change without notice.
Prefer `clean: true` unless you specifically need fields the parser omits.
