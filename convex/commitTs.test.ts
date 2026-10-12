/// <reference types="vite/client" />

import { expect, test } from "vitest";
import { defineSchema, defineTable } from "convex/server";
import { convexToJson, v } from "convex/values";
import { convexTest } from "../index";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import counterSchema from "./counter/component/schema";

const counterModules = import.meta.glob("./counter/component/**/*.ts");

function expectBigint(value: unknown): bigint {
  if (typeof value !== "bigint") {
    expect.fail(`expected a bigint, got ${typeof value}`);
  }
  return value;
}

test("insert reads back unresolved, commits as an increasing int64", async () => {
  const t = convexTest(schema);
  const first = await t.mutation(api.commitTs.insertAndReadBack, {});
  const second = await t.mutation(api.commitTs.insertAndReadBack, {});

  const timestamps: bigint[] = [];
  for (const id of [first, second]) {
    const doc = await t.query(api.commitTs.getCommitTs, { id });
    expect(doc.commitTs).toBe(doc.nestedCommitTs);
    timestamps.push(expectBigint(doc.commitTs));
  }
  expect(timestamps[0]).toBeLessThan(timestamps[1]);
  expect(await t.query(api.commitTs.commitTsInIndexOrder, {})).toEqual(timestamps);
});

test("placeholder round-trips through a nested mutation's args and return", async () => {
  const t = convexTest(schema);
  await t.mutation(api.commitTs.callNestedWithCommitTsArg, {});
  const timestamps = await t.query(api.commitTs.commitTsInIndexOrder, {});
  expect(timestamps).toHaveLength(2);
  expect(timestamps[0]).toBe(timestamps[1]);
  expectBigint(timestamps[0]);
});

test("nested query reads the parent's pending write", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.commitTs.nestedQueryReadsPending, {});
  const doc = await t.query(api.commitTs.getDoc, { id });
  expectBigint(doc!.commitTs);
});

test("a top-level mutation's return value is resolved", async () => {
  const t = convexTest(schema);
  const returned = await t.mutation(api.commitTs.returnCommitTs, {});
  expectBigint(returned.ts);
  expect(returned.nested[0]).toBe(returned.ts);
  const doc = await t.query(api.commitTs.getDoc, { id: returned.id });
  expect(doc!.commitTs).toBe(returned.ts);
});

test("index ranges over pending rows", async () => {
  const t = convexTest(schema);
  expect(await t.mutation(api.commitTs.indexRangeOverPending, {})).toBe(0);
  expect(await t.mutation(api.commitTs.indexRangeOverPending, {})).toBe(2);

  expect(await t.query(api.commitTs.indexRangeEqPlaceholderInQuery, {})).toBe(0);
});

test("scheduling with a placeholder argument is rejected", async () => {
  const t = convexTest(schema);
  await expect(t.mutation(api.commitTs.scheduleWithCommitTs, {})).rejects.toThrow(
    "Invalid arguments",
  );
});

test("a query cannot return a placeholder", async () => {
  const t = convexTest(schema);
  await expect(t.query(api.commitTs.queryReturnsPlaceholder, {})).rejects.toThrow(
    "return value invalid",
  );
});

test("patch", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.commitTs.patchPendingAndReadBack, {});
  const doc = await t.query(api.commitTs.getDoc, { id });
  const firstCommitTs = expectBigint(doc!.commitTs);
  expect(doc!.other).toBe("world");

  await t.mutation(api.commitTs.patchCommitTsIntoCommittedDocument, { id });
  const patched = await t.query(api.commitTs.getDoc, { id });
  expect(patched!.commitTs).toBe(firstCommitTs);
  expect(expectBigint(patched!.patchedCommitTs)).toBeGreaterThan(firstCommitTs);
});

test("replace", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.commitTs.replacePendingAndReadBack, {});
  const doc = await t.query(api.commitTs.getDoc, { id });
  expectBigint(doc!.replacedCommitTs);
  expect(doc!.commitTs).toBeUndefined();
});

test("t.run is a top-level transaction, so its placeholders resolve", async () => {
  const t = convexTest(schema);
  const ts = expectBigint(await t.run(async (ctx) => ctx.db.vars.commitTs));

  const id = await t.run(async (ctx) =>
    ctx.db.insert("commitTs", { commitTs: ctx.db.vars.commitTs }),
  );
  const committed = expectBigint(await t.run(async (ctx) => (await ctx.db.get(id))!.commitTs));
  expect(committed).toBeGreaterThan(ts);
});

test("paginating over rows staged in the writing mutation", async () => {
  const t = convexTest(schema);
  const result = await t.mutation(api.commitTs.paginateOverPending, {});
  expect(result.pageSize).toBe(2);
  expect(result.isDone).toBe(false);
  const [commitTsKey] = JSON.parse(result.continueCursor) as string[];
  expect(JSON.parse(commitTsKey)).toEqual(convexToJson(2n ** 63n - 1n));
});

test("filtering on a field staged in the writing mutation", async () => {
  const t = convexTest(schema);
  await t.mutation(api.commitTs.insertAndReadBack, {});
  expect(await t.mutation(api.commitTs.filterOverPending, {})).toBe(2);
});

test("staged rows sort after committed ones", async () => {
  const t = convexTest(schema);
  await t.mutation(api.commitTs.insertAndReadBack, {});
  expect(await t.mutation(api.commitTs.stagedRowsSortLast, {})).toEqual({
    total: 2,
    stagedIsLast: true,
  });
});

test("a rolled back mutation writes nothing, and later commits still advance", async () => {
  const t = convexTest(schema);
  const before = await t.mutation(api.commitTs.returnCommitTs, {});
  await expect(t.mutation(api.commitTs.insertThenThrow, {})).rejects.toThrow("rollback");
  expect(await t.query(api.commitTs.commitTsInIndexOrder, {})).toEqual([before.ts]);
  const after = await t.mutation(api.commitTs.returnCommitTs, {});
  expect(expectBigint(after.ts)).toBeGreaterThan(expectBigint(before.ts));
});

test("the app and a component share one commit timestamp", async () => {
  const t = convexTest(schema);
  t.registerComponent("counter", counterSchema, counterModules);
  const id = await t.mutation(internal.component.writeCommitTsAcrossComponents);
  const appCommitTs = expectBigint((await t.query(api.commitTs.getDoc, { id }))!.commitTs);
  const componentCommitTs = await t.query(components.counter.public.getCommitTs, {
    name: "commitTs",
  });
  expect(componentCommitTs).toBe(appCommitTs);
});

test("validators treat a placeholder as the int64 it will become", async () => {
  const int64Schema = defineSchema({
    values: defineTable({ ts: v.int64() }),
  });
  const t = convexTest(int64Schema);
  const id = await t.run(async (ctx) =>
    ctx.db.insert("values", { ts: ctx.db.vars.commitTs as any }),
  );
  expectBigint(await t.run(async (ctx) => (await ctx.db.get(id))!.ts));

  const stringSchema = defineSchema({
    values: defineTable({ ts: v.string() }),
  });
  const t2 = convexTest(stringSchema);
  await expect(
    t2.run(async (ctx) => ctx.db.insert("values", { ts: ctx.db.vars.commitTs as any })),
  ).rejects.toThrow("Validator error");
});

test("v.commitTs() accepts a resolved timestamp", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.commitTs.patchPendingAndReadBack, {});
  await t.mutation(api.commitTs.patchCommitTsIntoCommittedDocument, { id });
  const doc = await t.query(api.commitTs.getDoc, { id });
  expectBigint(doc!.commitTs);
});
