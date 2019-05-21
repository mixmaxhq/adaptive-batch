# adaptive-batch

An adaptive batch tool. Adjusts concurrency to a keyed async batch function in response to
increased throughput.

The `adaptiveBatch` function wraps a getter function that queries some system for a given set of
keys, and returns their associated values in a `Map`. As `adaptiveBatch` receives requests for
specific keys, it returns cached copies, and for non-cached values, it batches multiple requests
together into chunks before passing those keys along to the underlying getter.

Note that `adaptiveBatch` does not apply backpressure, and is more useful for scenarios where low
latency and high concurrency are valued.

The basic mechanics of this tool are controlled by three parameters:

### `maxQueued`

The number of keys to leave in the queue before invoking the getter again.

### `maxConcurrent`

The maximum number of concurrent `getter` invocations allowed.

### `maxBatch`

The maximum number of keys to pass to the `getter` per invocation.

## Install

```sh
$ npm install @mixmaxhq/adaptive-batch
```

## Usage

```js
import adaptiveBatch from '@mixmaxhq/adaptive-batch';

const commonQuery = adaptiveBatch(query);

async function query(recordIdIterator) {
  return db.auxCollection.find({ _id: { $in: Array.from(recordIdIterator) } });
}

async function migrate(match = {}) {
  const users = await db.users.find(match);
  return Promise.all(users.map((user) => commonQuery(user.auxRecordId)));
}
```

## API

### `adaptiveBatch(getter, options)`

Accepts a `getter` that accepts an iterable of keys, and returns a `Map` associating keys to values.

Returns a function that accepts a key, and returns the value produced by a corresponding call to
`getter`.

```js
{
  maxBatch: number,        // defaults to Infinity
  maxConcurrent: number,   // defaults to Infinity
  maxQueued: number,       // defaults to Infinity
  permanentCache: boolean, // defaults to true
  missingValue: any,       // N/a by default
}
```

The `permanentCache` parameter determines whether key results are cached beyond the lifecycle of the
corresponding `getter` call.

The `missingValue` parameter provides a default value that `adaptiveBatch`'s returned function
returns when the corresponding value is missing from the `Map` returned by the `getter` call.
