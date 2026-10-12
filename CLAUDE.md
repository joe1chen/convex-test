# convex-test (fork)

`get-convex/convex-test` with Dogomedia's patches, kept as a STACK of four branches, each rebased
on the one below. FORK.md lists the patches and their rules.

| Branch    | Holds                                                                      |
|-----------|----------------------------------------------------------------------------|
| `mirror`  | upstream `main`, untouched. Never commit here; `git fetch upstream` moves it. |
| `tooling` | off `mirror`: THIS workspace's toolchain only — Biome (ultracite), TypeScript 7, vitest, lefthook, bun.lock, the manifest (name, source export, dependencies aligned with the host: convex, vitest, typescript). No source change. |
| `format`  | off `tooling`: `bun run format:layer` applied to upstream's code: comments stripped (the host's zero-comments rule; tool directives stay) and `biome check --write`. Regenerated, never hand-resolved. |
| `patches` | off `format`: every behaviour change of ours, one commit each with its reason, its tests, FORK.md. |

`main` is `patches`, fast-forward only. Hosts vendor `main` by git subtree.

**Only the final layer is checked.** `mirror`, `tooling` and `format` are never linted or tested;
lefthook skips them (and any rebase). Lint, typecheck and tests gate `patches` / `main`, and the
host's `check:packages`.

## Gate policy

1. `format` holds deterministic automatic fixes only, regenerated on every sync by
   `bun run format:layer`: the comment strip, then `biome check --write` (safe fixes, never
   `--unsafe`).
2. `patches` (our code) passes every gate: Biome with the full rules, typecheck, no comments
   (lefthook's `2_no-comments` on `patches` / `main`), and the tests.
3. Upstream's code is never edited by hand for style. Rules that upstream's code still breaks
   after step 1 and that have no safe fix are turned off in `tooling`'s `biome.json`. They are
   listed by name; the reason goes in the commit body. TypeScript 7's typecheck, upstream's whole
   suite and the `fork:` tests must pass.
4. A real bug that a lint rule reveals gets its own `patches` commit. FORK.md notes it as a
   candidate for an upstream PR.

The host does not check or strip the vendored copy again: `check` (what the host's
`check:packages` runs) is Biome only.

## Layout (upstream's)

- `index.ts` is the library, `transactionMetrics.ts` its limits. The package exports `index.ts`
  as source; there is no build.
- `convex/` is upstream's test app: Convex functions and the suite that exercises the library
  through them (`convex/*.test.ts`). `convex/counter/` is a test component.
- `bun run check`, `bun run typecheck` (the library, then `convex/`), `bun run test`.
- `bunx convex dev --once` / `bunx convex run file:fn '{...}'` run `convex/` against a real
  backend to compare behaviour.

## Taking a new upstream release

```
git fetch upstream --tags
git branch -f mirror upstream/main
git rebase --update-refs mirror patches        # moves tooling, format and patches together
```

- A conflict in `tooling` is a manifest or config conflict: keep ours, take upstream's new
  dependencies only where the host has them.
- A conflict in `format` is never resolved by hand: `git checkout --theirs -- index.ts
  transactionMetrics.ts convex && bun run format:layer && git add -A && git rebase --continue`
  (theirs = upstream's new text). `format:layer` runs the host's comment stripper
  (`tools/check-banned-patterns` in gongboo-ban, by absolute path, so it needs that checkout and
  cargo).
- A conflict in `patches` is semantic: read upstream's change, keep the rule FORK.md names.
- Then `bun install && bun run check && bun run typecheck && bun run test`, tag the base
  (`git tag base/vNEW 'vNEW^{commit}'`), push every branch (`main` fast-forwards to `patches`),
  record the sync in FORK.md, and in each host `bun run packages:sync convex-test`.

## Rules

- **Every fork rule has a test that names it** (`fork:` tests).
- **No comments**, as in the host: names, tests and commit bodies carry the why. Tool directives
  (`/// <reference>`, `@vitest-environment`, …) stay. Upstream's LICENSE stays untouched; a
  per-file license header would never be stripped.
- **No host knowledge.** The library knows nothing of the apps that vendor it.
- Runtime and package manager is Bun. Upstream's `package-lock.json` is left as the mirror has
  it; `bun.lock` is ours.
