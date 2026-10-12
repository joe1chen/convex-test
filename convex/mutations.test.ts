import { expect, test } from "vitest";
import { convexTest } from "../index";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

test("insert", async () => {
  const t = convexTest(schema);
  await t.mutation(api.mutations.insert, { body: "hello", author: "sarah" });
  const messages = await t.query(api.mutations.list);
  expect(messages).toMatchObject([{ body: "hello", author: "sarah" }]);
});

test("patch", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.mutations.insert, {
    body: "hello",
    author: "sarah",
  });
  await t.mutation(api.mutations.patch, { id, body: "hi" });
  const messages = await t.query(api.mutations.list);
  expect(messages).toMatchObject([{ body: "hi", author: "sarah" }]);
});

test("replace", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.mutations.insert, {
    body: "hello",
    author: "sarah",
  });
  await t.mutation(api.mutations.replace, { id, author: "michal", body: "hi" });
  const messages = await t.query(api.mutations.list);
  expect(messages).toMatchObject([{ body: "hi", author: "michal" }]);
});

test("delete", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.mutations.insert, {
    body: "hello",
    author: "sarah",
  });
  await t.mutation(api.mutations.deleteDoc, { id });
  const messages = await t.query(api.mutations.list);
  expect(messages).toMatchObject([]);
});

test("transaction", async () => {
  const t = convexTest(schema);
  await expect(async () => {
    await t.mutation(api.mutations.throws, { body: "hello", author: "sarah" });
  }).rejects.toThrowError("I changed my mind");

  const messages = await t.query(api.mutations.list);
  expect(messages).toMatchObject([]);
});

test("patch with _id", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.mutations.insert, {
    body: "hello",
    author: "sarah",
  });

  await t.run(async (ctx) => {
    await ctx.db.patch(id, { _id: id });
  });

  await expect(async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch(id, { _id: "nonsense" as Id<"messages"> });
    });
  }).rejects.toThrowError("does not match the document ID");
});

test("patch after insert", async () => {
  const t = convexTest(schema);
  const messages = await t.run(async (ctx) => {
    const id = await ctx.db.insert("messages", {
      body: "hello",
      author: "sarah",
    });
    await ctx.db.patch(id, { body: "hi" });
    return ctx.db.query("messages").collect();
  });
  expect(messages).toMatchObject([{ body: "hi", author: "sarah" }]);
});

test("patch undefined", async () => {
  const t = convexTest(schema);
  const messages = await t.run(async (ctx) => {
    const id = await ctx.db.insert("messages", {
      body: "hello",
      author: "sarah",
      embedding: [1, 1, 1],
    });
    await ctx.db.patch(id, { body: "hi", embedding: undefined });
    return ctx.db.query("messages").collect();
  });
  expect(messages).toHaveLength(1);
  const { body, author, embedding } = messages[0];
  expect(body).toStrictEqual("hi");
  expect(author).toStrictEqual("sarah");
  expect(embedding).toBeUndefined();
});

test("replace after insert", async () => {
  const t = convexTest(schema);
  const messages = await t.run(async (ctx) => {
    const id = await ctx.db.insert("messages", {
      body: "hello",
      author: "sarah",
    });
    await ctx.db.replace(id, { author: "michal", body: "hi" });
    return ctx.db.query("messages").collect();
  });
  expect(messages).toMatchObject([{ body: "hi", author: "michal" }]);
});

test("concurrent append", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.mutations.insert, {
    body: "hello",
    author: "lee",
  });
  const concurrentCalls = [];
  for (let i = 0; i < 10; i++) {
    concurrentCalls.push(t.mutation(api.mutations.append, { id, suffix: "!" }));
  }
  await Promise.all(concurrentCalls);
  const messages = await t.query(api.mutations.list);
  expect(messages).toMatchObject([{ body: "hello!!!!!!!!!!", author: "lee" }]);
});

test("delete is visible in transaction", async () => {
  const t = convexTest(schema);
  const id = await t.run(async (ctx) => {
    return await ctx.db.insert("messages", { body: "hello", author: "sarah" });
  });
  await t.run(async (ctx) => {
    await ctx.db.delete(id);
    expect(await ctx.db.get(id)).toBeNull();
    const first = await ctx.db.query("messages").first();
    expect(first).toBeNull();
  });
});

test("rollback subtransaction", async () => {
  const t = convexTest(schema);
  const result = await t.mutation(api.mutations.rolledBackSubtransaction, {});
  expect(result).toStrictEqual(2);
});

test("subtransaction commit then rollback parent", async () => {
  const t = convexTest(schema);
  await expect(async () => {
    await t.mutation(api.mutations.subtransactionCommitThenRollbackParent, {});
  }).rejects.toThrowError("I changed my mind");
  const docs = await t.query(api.mutations.list);
  expect(docs.length).toStrictEqual(0);
});

test("insert then patch in subtransaction", async () => {
  const t = convexTest(schema);
  const result = await t.mutation(api.mutations.insertThenPatchInSubtransaction, {});
  expect(result).toEqual(["hi"]);
});

test("insert then delete in subtransaction", async () => {
  const t = convexTest(schema);
  const result = await t.mutation(api.mutations.insertThenDeleteInSubtransaction, {});
  expect(result).toEqual([]);
});

test("snapshot query does not see pending writes", async () => {
  const t = convexTest(schema);
  const result = await t.mutation(api.mutations.snapshotQueryDoesNotSeePendingWrites, {});
  expect(result).toEqual({ withWrites: 1, withoutWrites: 0 });
});

test("snapshot query sees previously committed writes", async () => {
  const t = convexTest(schema);
  await t.mutation(api.mutations.insert, { body: "committed", author: "lee" });
  const result = await t.mutation(api.mutations.snapshotQueryDoesNotSeePendingWrites, {});
  expect(result).toEqual({ withWrites: 2, withoutWrites: 1 });
});
