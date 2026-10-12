import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { CommitTsPlaceholder, v } from "convex/values";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertThrows(f: () => unknown, message: string) {
  try {
    f();
  } catch {
    return;
  }
  throw new Error(`Expected an error: ${message}`);
}

export const insertAndReadBack = mutation(async ({ db }) => {
  const id = await db.insert("commitTs", {
    commitTs: db.vars.commitTs,
    nested: { commitTs: db.vars.commitTs },
  });

  const viaGet = (await db.get(id))!;
  assert(viaGet.commitTs === db.vars.commitTs, "db.get commitTs");
  assert(viaGet.nested!.commitTs === db.vars.commitTs, "db.get nested commitTs");

  const viaQuery = (await db.query("commitTs").withIndex("by_commit_ts").collect()).find(
    (d) => d._id === id,
  )!;
  assert(viaQuery.commitTs === db.vars.commitTs, "indexed query commitTs");

  const viaPaginate = (
    await db.query("commitTs").paginate({ cursor: null, numItems: 10 })
  ).page.find((d) => d._id === id)!;
  assert(viaPaginate.commitTs === db.vars.commitTs, "paginated query commitTs");

  assertThrows(() => Number(viaGet.commitTs), "Number() coercion");
  assertThrows(() => (viaGet.commitTs as any) + 1, "arithmetic coercion");
  assertThrows(() => JSON.stringify(viaGet), "JSON.stringify");

  return id;
});

export const patchPendingAndReadBack = mutation(async ({ db }) => {
  const id = await db.insert("commitTs", {
    commitTs: db.vars.commitTs,
    other: "hello",
  });

  await db.patch(id, { other: "world" });
  const patched = (await db.get(id))!;
  assert(patched.commitTs === db.vars.commitTs, "patch preserves commitTs");
  assert(patched.other === "world", "patch applies other fields");

  return id;
});

export const patchCommitTsIntoCommittedDocument = mutation({
  args: { id: v.id("commitTs") },
  handler: async ({ db }, { id }) => {
    await db.patch(id, { patchedCommitTs: db.vars.commitTs });
    const patched = (await db.get(id))!;
    assert(patched.patchedCommitTs === db.vars.commitTs, "patched commitTs reads back unresolved");
  },
});

export const replacePendingAndReadBack = mutation(async ({ db }) => {
  const id = await db.insert("commitTs", {
    commitTs: db.vars.commitTs,
  });

  await db.replace(id, { replacedCommitTs: db.vars.commitTs });
  const replaced = (await db.get(id))!;
  assert(replaced.replacedCommitTs === db.vars.commitTs, "replaced commitTs reads back unresolved");
  assert(replaced.commitTs === undefined, "replace discards the old body");

  return id;
});

export const getCommitTs = query({
  args: { id: v.id("commitTs") },
  handler: async ({ db }, { id }) => {
    const doc = (await db.get(id))!;
    return { commitTs: doc.commitTs, nestedCommitTs: doc.nested!.commitTs };
  },
});

export const getDoc = query({
  args: { id: v.id("commitTs") },
  handler: async ({ db }, { id }) => db.get(id),
});

export const commitTsInIndexOrder = query(async ({ db }) => {
  const docs = await db.query("commitTs").withIndex("by_commit_ts").collect();
  return docs.map((d) => d.commitTs);
});

export const insertCommitTsArg = mutation({
  args: { ts: v.commitTs() },
  returns: v.commitTs(),
  handler: async ({ db }, { ts }) => {
    await db.insert("commitTs", { commitTs: ts });
    return ts;
  },
});

export const callNestedWithCommitTsArg = mutation(async (ctx) => {
  const returned = await ctx.runMutation(api.commitTs.insertCommitTsArg, {
    ts: ctx.db.vars.commitTs,
  });
  assert(returned === ctx.db.vars.commitTs, "nested return value is the placeholder");
  await ctx.db.insert("commitTs", { commitTs: ctx.db.vars.commitTs });
});

export const nestedQueryReadsPending = mutation(async (ctx) => {
  const id = await ctx.db.insert("commitTs", {
    commitTs: ctx.db.vars.commitTs,
  });
  const doc = await ctx.runQuery(api.commitTs.getDoc, { id });
  assert(doc!.commitTs === ctx.db.vars.commitTs, "nested query returns the placeholder");
  return id;
});

export const returnCommitTs = mutation({
  returns: v.object({
    id: v.id("commitTs"),
    ts: v.commitTs(),
    nested: v.array(v.commitTs()),
  }),
  handler: async ({ db }) => {
    const id = await db.insert("commitTs", { commitTs: db.vars.commitTs });
    return { id, ts: db.vars.commitTs, nested: [db.vars.commitTs] };
  },
});

export const indexRangeOverPending = mutation(async ({ db, runQuery }) => {
  const eqPending = () =>
    db
      .query("commitTs")
      .withIndex("by_commit_ts", (q) => q.eq("commitTs", db.vars.commitTs))
      .collect();

  assert((await eqPending()).length === 0, "eq matches nothing before staging");

  const first = await db.insert("commitTs", { commitTs: db.vars.commitTs });
  const second = await db.insert("commitTs", { commitTs: db.vars.commitTs });

  const staged = await eqPending();
  assert(
    staged.length === 2 &&
      staged.some((d) => d._id === first) &&
      staged.some((d) => d._id === second),
    "eq matches exactly the staged rows",
  );
  assert(
    staged.every((d) => d.commitTs === db.vars.commitTs),
    "staged rows read back unresolved",
  );

  const nestedStaged = await runQuery(api.commitTs.indexRangeEqPlaceholderInQuery, {});
  assert(nestedStaged === 2, "nested query sees the same staged rows");

  const committed = await db
    .query("commitTs")
    .withIndex("by_commit_ts", (q) => q.lt("commitTs", db.vars.commitTs))
    .collect();
  assert(
    committed.every((d) => typeof d.commitTs === "bigint"),
    "lt matches only committed rows",
  );
  return committed.length;
});

export const indexRangeEqPlaceholderInQuery = query(async ({ db }) => {
  const rows = await db
    .query("commitTs")
    .withIndex("by_commit_ts", (q) => q.eq("commitTs", new CommitTsPlaceholder()))
    .collect();
  return rows.length;
});

export const scheduleWithCommitTs = mutation(async (ctx) => {
  await ctx.scheduler.runAfter(0, api.commitTs.insertCommitTsArg, {
    ts: ctx.db.vars.commitTs,
  });
});

export const queryReturnsPlaceholder = query(() => {
  return new CommitTsPlaceholder() as any;
});

export const insertThenThrow = mutation(async ({ db }) => {
  await db.insert("commitTs", { commitTs: db.vars.commitTs });
  throw new Error("rollback");
});

export const paginateOverPending = mutation(async ({ db }) => {
  await db.insert("commitTs", { commitTs: db.vars.commitTs, other: "a" });
  await db.insert("commitTs", { commitTs: db.vars.commitTs, other: "b" });
  await db.insert("commitTs", { commitTs: db.vars.commitTs, other: "c" });

  const page = await db
    .query("commitTs")
    .withIndex("by_commit_ts")
    .paginate({ cursor: null, numItems: 2 });
  return {
    pageSize: page.page.length,
    isDone: page.isDone,
    continueCursor: page.continueCursor,
  };
});

export const stagedRowsSortLast = mutation(async ({ db }) => {
  const staged = await db.insert("commitTs", { commitTs: db.vars.commitTs });
  const docs = await db.query("commitTs").withIndex("by_commit_ts").collect();
  return {
    total: docs.length,
    stagedIsLast: docs[docs.length - 1]._id === staged,
  };
});

export const filterOverPending = mutation(async ({ db }) => {
  await db.insert("commitTs", { commitTs: db.vars.commitTs });
  const matched = await db
    .query("commitTs")
    .filter((q) => q.gt(q.field("commitTs"), 0n))
    .collect();
  return matched.length;
});
