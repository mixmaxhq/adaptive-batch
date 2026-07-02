# adaptive-batch — repo card

> A map, not a manual. Keep it ~1 screen; point to detail, don't inline it.

## What it is
Published npm utility (`@mixmaxhq/adaptive-batch`) that wraps a keyed async getter and adaptively
batches requests to it — returning cached hits and chunking non-cached keys, adjusting concurrency to
throughput. No backpressure; tuned for low-latency / high-concurrency. A library, not a service.

## serves
role: Adaptive concurrency batching utility for keyed async getters, consumed as a library by Mixmax services.
referenced-by: [compose, service-sequences]

## Code map
- entry (`adaptiveBatch`) -> src/index.js
- helpers               -> src/utils.js
- build output          -> dist/ (rollup)

## Conventions
- **npm** (`package-lock.json`). Build via **rollup** (`rollup.config.js`) → `dist/`; tests are **Jest**; lint ESLint. Published to npm as `@mixmaxhq/adaptive-batch` via CI (**Jenkins**, `Jenkinsfile`).

## Run / test
- `npm install` · `npm test` (Jest) · `npm run build` (rollup) · `npm run lint`

## Load the matching domain card
- Cross-cutting library — load the consuming capability's card, not a `domain-*` for this repo.
