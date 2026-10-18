![YasogaN](https://socialify.git.ci/YasogaN/google-maps-compute-routes/image?description=1&descriptionEditable=An%20NPM%20module%20to%20compute%20routes%20from%20Google%20Maps&font=Source%20Code%20Pro&name=1&owner=1&theme=Auto)

<div align="center">

![](https://img.shields.io/github/license/YasogaN/google-maps-compute-routes.svg?style=for-the-badge&color=blue)
![](https://img.shields.io/github/forks/YasogaN/google-maps-compute-routes.svg?style=for-the-badge)
![](https://img.shields.io/github/stars/YasogaN/google-maps-compute-routes.svg?style=for-the-badge)
![](https://img.shields.io/github/watchers/YasogaN/google-maps-compute-routes.svg?style=for-the-badge)
![](https://img.shields.io/github/issues/YasogaN/google-maps-compute-routes.svg?style=for-the-badge)
![](https://img.shields.io/github/languages/code-size/YasogaN/google-maps-compute-routes?style=for-the-badge)

## Frameworks/Technologies

![](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

</div>

---

## Installation

Install with npm

```bash
  npm install google-maps-compute-routes
```

Install with yarn

```bash
  yarn add google-maps-compute-routes
```

---

## Usage/Examples

```ts
import { computeRoutes } from "google-maps-compute-routes";

const routes = await computeRoutes({
  origin: "Probike, Battaramulla",
  destination: "The Fab - Battaramulla",
  region: "lk",
  clean: true,
});
```

You can also pass a Google Maps directions URL instead of the waypoints:

```ts
const routes = await computeRoutes({
  url: "https://www.google.com/maps/dir/Probike+Battaramulla/The+Fab+-+Battaramulla/",
  clean: true,
});
```

Add intermediate stops with `waypoints`. Each stopover splits the route into its own leg:

```ts
const routes = await computeRoutes({
  origin: "Probike, Battaramulla",
  destination: "The Fab - Battaramulla",
  waypoints: ["Sasha Food Court Koswatta Battaramulla", "People's Bank Battaramulla"],
  region: "lk",
  clean: true,
});
// routes[0].legs.length === 3 (origin -> stop A -> stop B -> destination)
// routes[0].overview_path is an approximate path: one point per step plus the destination
```

### Get the ETA for a polyline

Pass a `polyline` (encoded string or an array of coordinates) to get the traffic-aware ETA and directions along that path. The first point becomes the origin, the last the destination, and the points in between become waypoints:

```ts
import { computeRoutes, encodePolyline } from "google-maps-compute-routes";

const polyline = encodePolyline([
  { latitude: 6.91191, longitude: 79.93237 },
  { latitude: 6.90777, longitude: 79.9304 },
  { latitude: 6.90215, longitude: 79.9153 },
]);

const routes = await computeRoutes({ polyline, region: "lk", clean: true });
// routes[0].duration_in_traffic -> live ETA for the path
```

A long polyline is simplified (Douglas-Peucker) and its remaining long segments subdivided, split into request-sized chunks and routed in order, returning one merged route. `overview_path` is the dense input; `waypoints` is the timed control points; each leg's `departure`/`arrival` chains from the `departure_time` (or, for `arrival_time`, backward then one refinement pass).

```ts
const routes = await computeRoutes({
  polyline,                       // may be longer than the 100-point request limit
  departure_time: new Date(),     // chained across chunks
  simplify: 10,                   // DP tolerance in metres (default 10)
  max_gap: 500,                   // longest segment after subdivision, default 100
  clean: true,
});
// routes[0].waypoints[i].arrival -> time the route reaches each control point
```

> Every point is a **stopover** and the endpoint has no pass-through ("via") mode, so densely sampled points inflate the route (measured: ~25 m spacing → up to ~1.9–3.4x distance; ~250–500 m → ~1.1x). Do not sample every 25 m — keep control points a few hundred metres apart (`max_gap`), or the ETA will be wrong.

### Compute a route matrix

Compute ETAs between many origins and destinations:

```ts
import { computeRouteMatrix } from "google-maps-compute-routes";

const matrix = await computeRouteMatrix({
  origins: ["Probike, Battaramulla", "Colombo Fort"],
  destinations: ["The Fab - Battaramulla", "Bandaranaike International Airport"],
  region: "lk",
});

matrix.elements[0].status;            // "OK" | "ERROR"
matrix.elements[0].condition;         // "ROUTE_EXISTS" | "ROUTE_NOT_FOUND"
matrix.elements[0].duration;          // live ETA (includes traffic)
matrix.elements[0].static_duration;   // ETA without traffic
```

The result mirrors the Routes API `computeRouteMatrix` stream: a flat list of elements, one per origin × destination pair. The endpoint is point-to-point, so the matrix is built by issuing one request per pair with bounded concurrency. Requests are paced to one per second by default (`requests_per_second`), so the fan-out does not trip the endpoint's anti-bot rate limiting. Failed pairs return `status: "ERROR"` instead of rejecting the whole matrix, and the documented 625 element limit is enforced. Pass `departure_time` (a `Date` or Unix seconds) to plan every pair for a chosen time.

### Travel modes

Both functions accept a `travel_mode` of `"driving"`, `"walking"`, `"bicycling"` or `"two_wheeler"`:

```ts
const routes = await computeRoutes({
  origin: "Probike, Battaramulla",
  destination: "The Fab - Battaramulla",
  travel_mode: "two_wheeler",
  region: "lk",
  clean: true,
});
```

See [the SKU mapping](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/skus.md) for how travel mode and waypoint count relate to the Routes API billing tiers.

### Departure and arrival times

Pass `departure_time` or `arrival_time` (a `Date` or Unix seconds) to plan the trip for a chosen time. The endpoint then returns the traffic-aware duration for that time instead of "now". The two options are mutually exclusive:

```ts
const routes = await computeRoutes({
  origin: "Nugegoda",
  destination: "Mount Lavinia",
  region: "lk",
  departure_time: new Date("2026-10-19T12:00:00+05:30"),
  clean: true,
});
// routes[0].legs is one leg per waypoint; each leg.duration is the
// traffic-aware time between its two waypoints
```

See the [timing map](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/endpoints/timing.md) for the request field and how per-waypoint timing works.

### Session cookies

Before a call issues any directions request it fetches `https://maps.google.com/` once to collect Google's session cookies (`NID`, `AEC`, `SEARCH_SAMESITE` and `__Secure-STRP`) into the client's cookie jar. This preflight is paced by `requests_per_second` like any other request, and a matrix warms up once for the whole run rather than once per pair.

### Arguments

All arguments are passed as a single object:

`url` - `string`: A Google Maps directions URL as explained [here](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/urls/directions.md). If omitted, `origin` and `destination` are required.

`origin` - `string | RouteLocation`: Starting point, either a free-text query or a structured location.

`destination` - `string | RouteLocation`: Ending point, either a free-text query or a structured location.

`waypoints` - `Array<string | RouteLocation>`: Optional intermediate stopover points. Each one splits the route into an additional leg. Defaults to `[]`.

`polyline` - `string | Coordinates[]`: Optional encoded polyline or coordinate path. When given it takes precedence over `url`, `origin`, `destination` and `waypoints`, and the traffic-aware ETA for that path is returned.

`travel_mode` - `"driving" | "walking" | "bicycling" | "two_wheeler"`: Optional travel mode. When omitted, the endpoint's default set of routes is returned.

`departure_time` - `Date | number`: Departure time to plan for, as a `Date` or Unix seconds. When omitted the route is planned from now. Mutually exclusive with `arrival_time`.

`arrival_time` - `Date | number`: Arrival time to plan for, as a `Date` or Unix seconds. Mutually exclusive with `departure_time`.

`simplify` - `number`: Polyline Douglas-Peucker tolerance in metres. Defaults to `10`; `0` disables simplification.

`max_gap` - `number`: Longest segment after subdividing a simplified polyline, in metres. Defaults to `100`; `0` disables subdivision. Raise it (e.g. `500`) when tracing a polyline so the stopovers are sparse enough not to inflate the route.

`max_points_per_request` - `number`: Points per request when a polyline is chunked. Defaults to `100` (the endpoint accepts 99 legs); the minimum is `2`.

A `RouteLocation` may contain `query`, `place_id` and/or `coordinates` (`{ latitude, longitude }`).

`language` - `string`: Response language (`hl`). Defaults to `"en"`.

`region` - `string`: Region bias (`gl`). Defaults to `"us"`.

`clean` - `boolean`: Whether to return a cleaned/parsed output (`ParsedRoute[]`) or raw JSON (`JsonArray`). Defaults to `false`.

`requests_per_second` - `number`: Maximum number of requests started per second. Requests are spaced evenly to stay within this rate, so a burst such as the matrix fan-out does not trigger anti-bot blocking. Defaults to `1`.

`proxy.proxyUrl` - `string`: Optional HTTP proxy URL.

`proxy.ignoreTls` - `boolean`: Whether to ignore TLS errors on the proxy. Defaults to `false`.

### Returns

`routes` - `Promise<ParsedRoute[] | JsonArray>`: A promise that resolves to route objects in these [formats](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/outputs/output.md) depending on the value of `clean`.

---

## Documentation

All documentation related to endpoints and URL formats used in this project can be found in the [docs](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/) folder. This module uses the `preview/directions` endpoint to compute routes. Note that everything included here was based on my research, so errors could be present. A pull request is always welcome (see [contributing](#contributing)).

For departure/arrival time control and per-waypoint leg timing, see the [timing map](https://github.com/YasogaN/google-maps-compute-routes/blob/main/docs/endpoints/timing.md). The route is returned as one leg per waypoint, and `departure_time` / `arrival_time` plan the trip for a chosen time.

---

## Related Projects

Part of the same family of Google Maps tools:

- [**google-maps-review-scraper**](https://github.com/YasogaN/google-maps-review-scraper) - fetch reviews for a Google Maps place.
- [**google-maps-places**](https://github.com/YasogaN/google-maps-places) - fetch place details from Google Maps.
- [**google-maps-compute-routes**](https://github.com/YasogaN/google-maps-compute-routes) - compute routes, ETAs and turn-by-turn directions (this project).
- [**protobuf-doc**](https://github.com/YasogaN/protobuf-doc) - a CLI that decodes and documents Google Maps protobuf query strings, used to research the `pb` payloads this module sends.

---

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/YasogaN/google-maps-compute-routes/blob/main/LICENSE) file for details.

### Summary of the MIT License

The **MIT License** is a permissive open-source license that allows users significant freedom with minimal conditions.

### Key Permissions:

1. **Freedom to Use**: You can use the software for any purpose, including commercial use.
2. **Freedom to Modify**: You are free to modify the software as needed.
3. **Freedom to Distribute**: You can distribute copies of the software, whether in its original or modified form.
4. **Freedom to Sell**: You can sublicense, distribute, and even sell copies of the software.

### Key Conditions:

- **Attribution**: You must include the original copyright notice and the MIT license text in any copies or substantial portions of the software.

### No Warranty:

- The software is provided "as is", without warranties or guarantees. The author is not liable for any damages arising from its use.

For full details, refer to the license text.

---

## Contributing

I welcome contributions from the community! Please see our [CONTRIBUTING.md](https://github.com/YasogaN/google-maps-compute-routes/blob/main/CONTRIBUTING.md) for details on how to contribute to this project.

---

## Code of Conduct

Please note that this project is governed by a [Code of Conduct](https://github.com/YasogaN/google-maps-compute-routes/blob/main/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Acknowledgements

Special thanks to [@marin-m](https://github.com/marin-m) for his outstanding work on the [pbtk](https://github.com/marin-m/pbtk) repository. His contributions and insights on protocol buffers were invaluable in my research and development process.

The `pb` payloads used by this module were decoded and documented with [protobuf-doc](https://github.com/YasogaN/protobuf-doc).

### Dependencies

- [impit](https://github.com/apify/impit) by [@apify](https://github.com/apify)
- [tough-cookie](https://github.com/salesforce/tough-cookie) by [@salesforce](https://github.com/salesforce)

---

## Legal Disclaimer

This project is not affiliated with, endorsed by, or associated with Google LLC or any of its products and services. All product and company names are trademarks or registered trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.

### Purpose of the Project

This project was created with the primary intent of serving as an educational tool and proof of concept. The objectives include:

- **Educational Use**: To provide a hands-on learning experience in developing software, using APIs, and understanding the integration of various technologies.
- **Proof of Concept**: To demonstrate the feasibility and potential of certain technical approaches and solutions.

### Non-Commercial Nature

This project is non-commercial and is not intended for any form of profit generation or business use. It is shared openly with the community to foster learning and collaboration.

### Intellectual Property and Fair Use

We acknowledge and respect the intellectual property rights of Google and other third parties. Any content used from external sources is credited appropriately, and no proprietary data or materials are misused.

### Contact and Legal Concerns

If you have any concerns or questions regarding the legality of this project, or any specific legal queries or issues, please seek professional legal advice.
