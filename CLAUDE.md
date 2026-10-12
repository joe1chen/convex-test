# convex-test (fork)

`get-convex/convex-test` with Dogomedia's patches, kept as a STACK of four branches, each rebased
on the one below. FORK.md lists the patches and their rules.

| Branch    | Holds                                                                      |
|-----------|----------------------------------------------------------------------------|
| `mirror`  | upstream `main`, untouched. Never commit here; `git fetch upstream` moves it. |
| `tooling` | off `mirror`: THIS workspace's toolchain only — Biome (ultracite), TypeScript 7, vitest, lefthook, bun.lock, the manifest (name, source export, dependencies aligned with the host: convex, vitest, typescript). No source change. |
| `format`  | off `tooling`: the formatter applied to `index.ts`, `transactionMetrics.ts` and `convex/`. Regenerated, never hand-resolved. |
| `patches` | off `format`: every behaviour change of ours, one commit each with its reason, its tests, FORK.md. |

`main` is `patches`, fast-forward only. Hosts vendor `main` by git subtree.

**Only the final layer is checked.** `mirror`, `tooling` and `format` are never linted or tested;
lefthook skips them (and any rebase). Lint, typecheck and tests gate `patches` / `main`, and the
host's `check:packages`.

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
  transactionMetrics.ts convex && bunx biome check --write . && git add -A && git rebase
  --continue` (theirs = upstream's new text).
- A conflict in `patches` is semantic: read upstream's change, keep the rule FORK.md names.
- Then `bun install && bun run check && bun run typecheck && bun run test`, tag the base
  (`git tag base/vNEW 'vNEW^{commit}'`), push every branch (`main` fast-forwards to `patches`),
  record the sync in FORK.md, and in each host `bun run packages:sync convex-test`.

## Rules

- **Every fork rule has a test that names it** (`fork:` tests).
- **No host knowledge.** The library knows nothing of the apps that vendor it.
- Runtime and package manager is Bun. Upstream's `package-lock.json` is left as the mirror has
  it; `bun.lock` is ours.
