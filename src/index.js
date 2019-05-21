import { defer } from 'promise-callbacks';

// Sentinel value because undefined and null might be valid values.
const SENTINEL = Object.create(null);

const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Extract num entries from map and return them in a new Map.
 *
 * @param {Map} map The source map.
 * @param {number} num The number of entries to extract.
 * @return {[Map, Map]} The first value is a new Map containing the remaining entries from the
 *   source map, and the second value is a new Map containing the extracted entries.
 */
function extractFrom(map, num) {
  if (!(num < map.size)) {
    return [new Map(), new Map(map)];
  }
  const output = new Map();
  const iter = map[Symbol.iterator]();
  for (const [k, v] of iter) {
    if (!num--) break;
    output.set(k, v);
  }
  return [new Map(iter), output];
}

/**
 * Provide a resolved result to the given deferred object.
 *
 * @param {Defer} d The defer object which
 * @param {Key} key
 * @param {Map} mapped
 * @param {*} missingValue
 */
function resolveResult(d, key, mapped, missingValue) {
  try {
    if (mapped.has(key)) {
      d.resolve(mapped.get(key));
    } else if (missingValue === SENTINEL) {
      d.reject(new Error('provided key not retrieved'));
    } else {
      d.resolve(missingValue);
    }
  } catch (err) {
    d.reject(err);
  }
}

/**
 * For an async getter that will fetch data for one or more keys, batch requests to the getter for
 * individual key requests by limiting concurrent getter requests. Concurrency increases when the
 * number of requested keys increases beyond the specified max, such that for n key requests we have
 * a concurrency of at most n/max+1. Caches all fetched key values, effectively memoizing the
 * results for each key.
 *
 * @param {function(Iterable<Key>): Promise<Map<Key, Value>>} getter The getter function, which
 *   takes an iterable of keys to fetch, and returns a Map of those keys to their corresponding
 *   values.
 * @param {number} options.maxQueued The maximum number of queued keys before increasing
 *   concurrency.
 * @param {number} options.maxConcurrent The maximum number of concurrent batch invocations - this
 *   takes precedence over maxQueued.
 * @param {number} options.maxBatch The maximum number of keys per batch invocation.
 * @param {*} options.missingValue The value to use if the getter didn't return the value.
 *   If _omitted_ (not just undefined), then the promise will reject.
 * @param {boolean} options.permanentCache Whether to permanently cache every key result - useful
 *   when the batched getter has a limited lifespan. As a general rule, pass false here if the batch
 *   tool is used globally in a long-running process like a server.
 * @return {function(Key): Promise<Value>} The single-key getter that batches requests to the
 *   batchable getter, or uses the cached value if available.
 */
function adaptiveBatch(getter, options = {}) {
  const {
    maxConcurrent = Infinity,
    maxBatch = Infinity,
    maxQueued = Infinity,
    permanentCache = true,
  } = options;

  const missingValue = hasOwn.call(options, 'missingValue') ? options.missingValue : SENTINEL;

  // The active concurrency.
  let busy = 0,
    // <Key, Defer<Value>>
    queue = new Map();

  // <Key, Promise<Value>>
  const cache = new Map();

  /**
   * Pull a specific set of keys, and resolve the provided Defer objects with the results. If the
   * getter fails, reject all the Defer objects with the error.
   *
   * @param {Map<Key, Defer<Value>>} q The queue. This is now the only reference to this object.
   * @return {Promise<void>} Resolves when the pull is complete; should not ever reject.
   */
  async function pull(q) {
    ++busy;
    try {
      let mapped;
      try {
        mapped = await getter(q.keys());
        if (!mapped || typeof mapped.has !== 'function' || typeof mapped.get !== 'function') {
          throw new TypeError('expected Map');
        }
      } catch (err) {
        for (const d of q.values()) {
          d.reject(err);
        }
        return;
      }
      for (const [key, d] of q) {
        resolveResult(d, key, mapped, missingValue);
      }
    } finally {
      --busy;
      Promise.resolve().then(() => {
        if (queue.size) {
          maybePull();
        }
      });
    }
  }

  /**
   * Initiate a pull, consuming the current queue and triggering subsequent pulls if there's more
   * work to be done without needing additional concurrency.
   */
  function doPull() {
    let q;
    [queue, q] = extractFrom(queue, maxBatch);
    pull(q);
  }

  /**
   * Attempt pulls until pulling is not applicable based on the max criteria.
   */
  function maybePull() {
    if (!busy) {
      doPull();
    }
    while (queue.size >= maxQueued && busy < maxConcurrent) {
      doPull();
    }
  }

  /**
   * Ask the getter for the value corresponding to the provided key. May be batched with other
   * keys for better throughput/lower overhead.
   *
   * @param {Key} key The key to request.
   * @return {Promise<Value>} The resolved key value. Rejects if no missingValue was provided in
   *   the options.
   */
  return async function get(key) {
    if (cache.has(key)) {
      return cache.get(key);
    }
    const d = defer();
    queue.set(key, d);
    cache.set(key, d.promise);
    maybePull();
    try {
      return await d.promise;
    } finally {
      if (!permanentCache) {
        cache.delete(key);
      }
    }
  };
}

export default adaptiveBatch;
