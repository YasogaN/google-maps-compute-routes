# Routes API SKU mapping

The Routes API bills `Compute Routes` and `Compute Route Matrix` under three SKU tiers each. This module mirrors the public Routes API surface where the internal web endpoint allows, so it helps to know which tier a request maps to. This page is informational; scraping the web endpoint is not billed.

## Compute Routes

| Tier | Triggers |
| ---- | -------- |
| Essentials | Basic request with no Pro or Enterprise features. |
| Pro | 11–25 intermediate waypoints; `optimizeWaypointOrder: true`; `routingPreference` of `TRAFFIC_AWARE` or `TRAFFIC_AWARE_OPTIMAL`; location modifiers (side of road, heading, vehicle stopover). |
| Enterprise | Two-wheeled vehicle routing; toll calculation; traffic information on polylines; large vehicle routing. |

## Compute Route Matrix

Billed **per element**, where the number of elements is origins × destinations.

| Tier | Triggers |
| ---- | -------- |
| Essentials | Each element with no Pro or Enterprise features. |
| Pro | `routingPreference` of `TRAFFIC_AWARE` or `TRAFFIC_AWARE_OPTIMAL`; location modifiers (side of road, heading, vehicle stopover). |
| Enterprise | Two-wheeled vehicle routing elements; toll calculation elements; large vehicle routing elements. |

## Supported in this module

- **Travel mode** (`travel_mode`): `driving`, `walking` and `bicycling` stay in Essentials; `two_wheeler` maps to the Enterprise tier.
- **Waypoints**: the documented maximum of 25 intermediate waypoints is enforced (`MAX_INTERMEDIATE_WAYPOINTS`). More than 10 intermediate waypoints is a Pro trigger on the public API.
- **Matrix size**: the documented maximum of 625 elements is enforced (`MAX_MATRIX_ELEMENTS`).
- **Traffic-aware durations**: the endpoint always returns live traffic, so the `duration` fields are traffic-aware (equivalent to `TRAFFIC_AWARE`).

## Not supported

The internal web endpoint does not expose waypoint optimization, toll calculation, traffic-on-polyline, large vehicle routing, or location modifiers (side of road, heading, stopover).
