/**
 * Extract num entries from map and return them in a new Map.
 *
 * @param {Map} map The source map.
 * @param {number} num The number of entries to extract.
 * @return {[Map, Map]} The first value is a new Map containing the remaining entries from the
 *   source map, and the second value is a new Map containing the extracted entries.
 */
export function extractFrom(map, num) {
  if (!(num < map.size)) {
    return [new Map(), new Map(map)];
  }
  const output = new Map();
  const iter = map[Symbol.iterator]();
  if (num) {
    for (const [k, v] of iter) {
      output.set(k, v);
      if (!--num) break;
    }
  }

  return [new Map(iter), output];
}
