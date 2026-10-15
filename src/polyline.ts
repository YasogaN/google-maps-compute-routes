import type { Coordinates } from "./types.js";

/**
 * Encode a single signed delta using the Google encoded-polyline algorithm.
 *
 * @param value The signed delta to encode.
 * @returns The encoded chunk.
 */
function encodeValue(value: number): string {
    let remaining = value < 0 ? ~(value << 1) : value << 1;
    let encoded = "";
    while (remaining >= 0x20) {
        encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
        remaining >>= 5;
    }
    encoded += String.fromCharCode(remaining + 63);
    return encoded;
}

/**
 * Encode coordinates using the Google encoded-polyline algorithm.
 *
 * @param coordinates The coordinates to encode.
 * @returns The encoded polyline string.
 */
export function encodePolyline(coordinates: Coordinates[]): string {
    let previousLatitude = 0;
    let previousLongitude = 0;
    let encoded = "";

    for (const { latitude, longitude } of coordinates) {
        const latitudeE5 = Math.round(latitude * 1e5);
        const longitudeE5 = Math.round(longitude * 1e5);
        encoded += encodeValue(latitudeE5 - previousLatitude);
        encoded += encodeValue(longitudeE5 - previousLongitude);
        previousLatitude = latitudeE5;
        previousLongitude = longitudeE5;
    }

    return encoded;
}

/**
 * Decode a Google encoded polyline into coordinates.
 *
 * @param encoded The encoded polyline string.
 * @returns The decoded coordinates (empty when the input is empty).
 */
export function decodePolyline(encoded: string): Coordinates[] {
    const coordinates: Coordinates[] = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        latitude += result & 1 ? ~(result >> 1) : result >> 1;

        result = 0;
        shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        longitude += result & 1 ? ~(result >> 1) : result >> 1;

        coordinates.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
    }

    return coordinates;
}
