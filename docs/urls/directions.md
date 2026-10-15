# URL: directions

## URL

```ruby
https://www.google.com/maps/dir/
```

## Parameters

- `Origin`: Starting point (whitespaces denoted by `+`).
- `Destination`: Ending point (whitespaces denoted by `+`).
- `Latitude`: Latitude of the point at the center of the screen.
- `Longitude`: Longitude of the point at the center of the screen.
- `Zoom Level`: Zoom level of the map.
- `PBData`: Protobuffer data with the prefix `data=`.

## Construction of the URL

- First Level: `Origin` and `Destination` separated by `/`.

    eg: `Probike+Battaramulla/The+Fab+-+Battaramulla`

- Second Level (optional): `Latitude`, `Longitude` and `Zoom Level` separated by
  commas (`,`), starting with the `@` character and ending with the letter `z`.

    eg: `@6.9117058,79.9329593,16z`

- Third Level (optional): `PBData` with the prefix `data=`.

    eg: `data=!4m8!4m7!1m0!1m5!1m1!1s0x3ae2574e380e5d51:0x3f8e276090ada013!...`

## Constructed URL

```ruby
https://www.google.com/maps/dir/[Origin]/[Destination]/@[Latitude],[Longitude],[ZoomLevel]z/data=[PBData]
```

## Sample URL

```ruby
https://www.google.com/maps/dir/Probike+Battaramulla/The+Fab+-+Battaramulla/@6.9117058,79.9329593,16z
```

## Query form

Google Maps also accepts the waypoints as query parameters:

```ruby
https://www.google.com/maps/dir/?api=1&origin=[Origin]&destination=[Destination]
```

## Accepted input

This library accepts either form. It only reads the origin and destination, so
the optional `@lat,lng,zoomz` and `data=` segments may be present or absent.

## Intermediate waypoints

Google Maps routes through intermediate stops by inserting further waypoint
segments between the origin and destination:

```ruby
https://www.google.com/maps/dir/[Origin]/[Waypoint]/[Destination]/
```

Each stopover splits the result into one leg per segment. The library exposes
these through the `waypoints` option (see the [endpoint docs](../endpoints/previewdirections.md#waypoints)).
