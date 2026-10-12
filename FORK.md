# This fork of `convex-test`

This `convex-test` is
[get-convex/convex-test](https://github.com/get-convex/convex-test) with
Dogomedia's patches on top, kept as the branch stack CLAUDE.md describes
(`mirror` → `tooling` → `format` → `patches` = `main`). The base is a tagged
upstream commit (`base/v0.0.61` = upstream `v0.0.61`, 2026-10-09);
`git log base/v0.0.61..main` is everything of ours.

## Using it from a host

- The package exports `index.ts` as source; there is no build. It keeps
  upstream's name, `convex-test`, so a host REPLACES npm's copy for its whole
  dependency tree: it vendors `main` by `git subtree`, depends on it as
  `workspace:*` and overrides `convex-test` to `workspace:*` (Bun's
  `overrides`), which leaves one copy, linked as `node_modules/convex-test`.
  Imports stay `from "convex-test"`. Third-party test helpers
  (`@convex-dev/*/test`) import `convex-test` too and type `register(t)` against
  its `TestConvex`; a second copy under another name is not assignable to
  them.
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

### Optional absent keys in `getFunctionPathFromAddress` (upstream-PR candidate)

Hosts compile `index.ts` under their own settings. With `strict: false`,
`getFunctionAddress`'s result (`name?: never`, …) did not fit a parameter that
required the absent keys as `undefined`. The keys are now optional.
`bun run typecheck` also compiles the library with `tsconfig.non-strict-host.json`.

### ES2021 lib in the library (upstream-PR candidate)

Convex's `convex/tsconfig.json` template compiles with `lib: ["es2021"]`, and
a host checks `index.ts` as source under its own lib. `createTestJwt` read its
claim names through `Object.hasOwn` (ES2022); the table is now a `Map`.
`bun run typecheck` also compiles the library with `tsconfig.es2021-host.json`.

## Gates

CLAUDE.md "Gate policy": `format` is `bun run format:layer` (comment strip, then
`biome check --write`). Upstream's remaining rule violations are a named list in
`biome.json`. Our commits pass the full rules, the no-comments hook, typecheck
and tests.

## Sync record

- `base/v0.0.61` (2026-10-12): initial fork. Upstream's 375 tests pass after
  `format:layer` (TypeScript 7, vitest 5, convex 1.46.0). The stripper keeps
  TypeScript directives and license notices (gongboo-ban 376a123a), so
  upstream's 25 `@ts-expect-error` assertions survive the format layer.
