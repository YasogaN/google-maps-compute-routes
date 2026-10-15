/**
 * Safely traverse a nested array structure using a path of indices.
 *
 * @param value  The nested array structure to traverse.
 * @param path   An array of indices specifying the path to the target element.
 * @returns The value at the given path, or `undefined` if traversal fails.
 */
export function getPath(value: unknown, path: number[]): unknown {
  let current = value;
  for (const index of path) {
    if (!Array.isArray(current)) return undefined;
    current = current[index];
  }
  return current;
}

/**
 * Return the value if it is a string, otherwise return an empty string.
 *
 * @param value The value to coerce.
 * @returns The original string, or `""`.
 */
export function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Return the value if it is a number, otherwise return 0.
 *
 * @param value The value to coerce.
 * @returns The original number, or `0`.
 */
export function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}
