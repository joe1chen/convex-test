# This fork of `convex-test`

`@joe1chen/convex-test` is
[get-convex/convex-test](https://github.com/get-convex/convex-test) with
Dogomedia's patches on top, kept as the branch stack CLAUDE.md describes
(`mirror` → `tooling` → `format` → `patches` = `main`). The base is a tagged
upstream commit (`base/v0.0.61` = upstream `v0.0.61`, 2026-10-09);
`git log base/v0.0.61..main` is everything of ours.

## Using it from a host

- The package exports `index.ts` as source; there is no build. Hosts depend on
  it as `workspace:*` from a `git subtree` of `main` and import
  `@joe1chen/convex-test` where they imported `convex-test`.
- **Always pass `modules`.** Without them `convexTest` falls back to
  upstream's `import.meta.glob("./convex/**/*.*s")`, which in source form is
  relative to this package's `index.ts` and finds this repository's test app,
  not the host's functions (upstream's build rewrote that path for
  `node_modules/convex-test/dist`).

## Patches

### `t.settleScheduledFunctions(maxIterations = 100)`

Brings an instance's scheduled work to rest, typically in an `afterEach`:

1. every scheduled function that has not started, in the app and in every
   registered component, is cancelled: its job document moves to `canceled`
   (as `ctx.scheduler.cancel` does; one cancelled earlier stays as it is) and
   its timer is cleared, so nothing fires later, with real or fake timers;
2. the functions in progress are awaited;
3. repeat until nothing is pending or in progress. A pending function never
   starts once settling has begun; only functions started by running ones,
   while they run, need another iteration. After `maxIterations` it throws.

How: the per-test `Scheduler` keeps a set of pending functions, each holding
its timer's clear function (captured with the `setTimeout` that registered
it, so the matching implementation clears it) and the cancellation of its
job. `finishAllScheduledFunctions` reads that set where upstream kept a count.
No system-table scan, no `runInComponent` from the caller.

Tests: `convex/settleScheduledFunctions.test.ts` (`fork:`): a pending app
function cancelled and its timer gone, a pending component function cancelled,
an earlier cancel left alone, an instance at rest settling with zero
iterations, a function in progress awaited, and functions that keep starting
more while they run throwing after `maxIterations`.

## Sync record

- `base/v0.0.61` (2026-10-12): initial fork. Upstream's 375 tests pass on the
  tooling layer unchanged (TypeScript 7, vitest 5, convex 1.46.0).
