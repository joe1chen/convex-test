import { expect, test } from "vitest";
import { convexTest } from "../index";
import { api } from "./_generated/api";
import schema from "./schema";
import type { PaginationResult } from "convex/server";

test("paginate", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello1" });
    await ctx.db.insert("messages", { author: "michal", body: "boo" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello2" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello3" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello4" });
    await ctx.db.insert("messages", { author: "michal", body: "boing" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello5" });
  });
  const { continueCursor, isDone, page } = await t.query(api.pagination.list, {
    author: "sarah",
    paginationOptions: {
      cursor: null,
      numItems: 2,
    },
  });
  expect(page).toMatchObject([
    { author: "sarah", body: "hello1" },
    { author: "sarah", body: "hello2" },
  ]);
  expect(isDone).toEqual(false);
  const {
    continueCursor: continueCursor2,
    isDone: isDone2,
    page: page2,
  } = await t.query(api.pagination.list, {
    author: "sarah",
    paginationOptions: {
      cursor: continueCursor,
      numItems: 4,
    },
  });
  expect(page2).toMatchObject([
    { author: "sarah", body: "hello3" },
    { author: "sarah", body: "hello4" },
    { author: "sarah", body: "hello5" },
  ]);
  expect(isDone2).toEqual(true);

  const { isDone: isDone3, page: page3 } = await t.query(api.pagination.list, {
    author: "sarah",
    paginationOptions: {
      cursor: continueCursor2,
      numItems: 4,
    },
  });
  expect(page3).toMatchObject([]);
  expect(isDone3).toEqual(true);
});

test("paginate with maximumRowsRead", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    for (let i = 0; i < 10; i++) {
      await ctx.db.insert("messages", {
        author: "sarah",
        body: `msg${i}`,
      });
    }
  });

  const result = (await t.query(api.pagination.listAll, {
    paginationOptions: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 3,
    },
  })) as PaginationResult<any>;

  expect(result.page.length).toBeLessThanOrEqual(3);
  expect(result.pageStatus).toEqual("SplitRequired");
  expect(result.splitCursor).toBeTruthy();
  expect(result.isDone).toEqual(false);

  const result2 = (await t.query(api.pagination.listAll, {
    paginationOptions: {
      cursor: result.continueCursor,
      numItems: 10,
    },
  })) as PaginationResult<any>;

  expect(result.page.length + result2.page.length).toEqual(10);
  expect(result2.isDone).toEqual(true);
});

test("paginate with maximumBytesRead", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("messages", {
        author: "sarah",
        body: "x".repeat(100),
      });
    }
  });

  const result = (await t.query(api.pagination.listAll, {
    paginationOptions: {
      cursor: null,
      numItems: 10,
      maximumBytesRead: 1,
    },
  })) as PaginationResult<any>;

  expect(result.page.length).toBeLessThanOrEqual(1);
  expect(result.pageStatus).toEqual("SplitRequired");
  expect(result.isDone).toEqual(false);
});

test("paginate with filter and maximumRowsRead", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    for (let i = 0; i < 10; i++) {
      await ctx.db.insert("messages", {
        author: i % 3 === 0 ? "sarah" : "michal",
        body: `msg${i}`,
      });
    }
  });

  const result = (await t.query(api.pagination.list, {
    author: "sarah",
    paginationOptions: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 5,
    },
  })) as PaginationResult<any>;

  expect(result.pageStatus).toEqual("SplitRequired");
  expect(result.isDone).toEqual(false);
});

test("paginate with endCursor", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("messages", {
        author: "sarah",
        body: `msg${i}`,
      });
    }
  });

  const result1 = (await t.query(api.pagination.listAll, {
    paginationOptions: {
      cursor: null,
      numItems: 2,
    },
  })) as PaginationResult<any>;

  expect(result1.page.length).toEqual(2);
  expect(result1.isDone).toEqual(false);

  const result2 = (await t.query(api.pagination.listAll, {
    paginationOptions: {
      cursor: result1.continueCursor,
      numItems: 2,
    },
  })) as PaginationResult<any>;

  expect(result2.page.length).toEqual(2);

  const result3 = (await t.query(api.pagination.listAll, {
    paginationOptions: {
      cursor: result1.continueCursor,
      numItems: 100,
      endCursor: result2.continueCursor,
    },
  })) as PaginationResult<any>;

  expect(result3.page.length).toEqual(result2.page.length);
});
test("paginate with index on optional field with undefined values", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", {
      author: "sarah",
      body: "hello1",
      score: 10,
    });
    await ctx.db.insert("messages", { author: "sarah", body: "hello2" });
    await ctx.db.insert("messages", {
      author: "sarah",
      body: "hello3",
      score: 5,
    });
    await ctx.db.insert("messages", { author: "sarah", body: "hello4" });
  });
  const { continueCursor, isDone, page } = await t.query(
    api.pagination.listWithOptionalFieldIndex,
    {
      author: "sarah",
      paginationOptions: {
        cursor: null,
        numItems: 2,
      },
    },
  );
  expect(page).toMatchObject([
    { author: "sarah", body: "hello2" },
    { author: "sarah", body: "hello4" },
  ]);
  expect(isDone).toEqual(false);
  const { isDone: isDone2, page: page2 } = await t.query(
    api.pagination.listWithOptionalFieldIndex,
    {
      author: "sarah",
      paginationOptions: {
        cursor: continueCursor,
        numItems: 4,
      },
    },
  );
  expect(page2).toMatchObject([
    { author: "sarah", body: "hello3", score: 5 },
    { author: "sarah", body: "hello1", score: 10 },
  ]);
  expect(isDone2).toEqual(true);
});

test("paginate with deletes", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello1" });
    await ctx.db.insert("messages", { author: "michal", body: "boo" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello2" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello3" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello4" });
    await ctx.db.insert("messages", { author: "michal", body: "boing" });
    await ctx.db.insert("messages", { author: "sarah", body: "hello5" });
  });
  const { continueCursor, isDone, page } = await t.query(api.pagination.list, {
    author: "sarah",
    paginationOptions: {
      cursor: null,
      numItems: 2,
    },
  });
  expect(page).toMatchObject([
    { author: "sarah", body: "hello1" },
    { author: "sarah", body: "hello2" },
  ]);
  expect(isDone).toEqual(false);
  await t.run(async (ctx) => {
    await ctx.db.delete(page[1]._id);
  });
  const { isDone: isDone2, page: page2 } = await t.query(api.pagination.list, {
    author: "sarah",
    paginationOptions: {
      cursor: continueCursor,
      numItems: 4,
    },
  });
  expect(page2).toMatchObject([
    { author: "sarah", body: "hello3" },
    { author: "sarah", body: "hello4" },
    { author: "sarah", body: "hello5" },
  ]);
  expect(isDone2).toEqual(true);
});

test("paginate with deletes and indexes", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello1" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello1" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello2" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello3" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello4" });
  });
  const { continueCursor, isDone, page } = await t.query(api.pagination.listWithIndex, {
    author: "jordan",
    paginationOptions: {
      cursor: null,
      numItems: 1,
    },
  });
  expect(page).toMatchObject([{ author: "jordan", body: "hello1" }]);
  expect(isDone).toEqual(false);
  await t.run(async (ctx) => {
    await ctx.db.delete(page[0]._id);
  });
  const {
    isDone: isDone2,
    page: page2,
    continueCursor: continueCursor2,
  } = await t.query(api.pagination.listWithIndex, {
    author: "jordan",
    paginationOptions: {
      cursor: continueCursor,
      numItems: 2,
    },
  });
  expect(page2).toMatchObject([
    { author: "jordan", body: "hello2" },
    { author: "jordan", body: "hello3" },
  ]);
  expect(isDone2).toEqual(false);
  await t.run(async (ctx) => {
    await ctx.db.delete(page2[1]._id);
  });
  const { isDone: isDone3, page: page3 } = await t.query(api.pagination.listWithIndex, {
    author: "jordan",
    paginationOptions: {
      cursor: continueCursor2,
      numItems: 1,
    },
  });
  expect(page3).toMatchObject([{ author: "jordan", body: "hello4" }]);
  expect(isDone3).toEqual(true);
});

test("paginate with deletes and composite index", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello1" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello2" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello4" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello3" });
    await ctx.db.insert("messages", { author: "jordan", body: "hello1" });
  });
  const { continueCursor, isDone, page } = await t.query(api.pagination.listWithCompositeIndex, {
    author: "jordan",
    paginationOptions: {
      cursor: null,
      numItems: 1,
    },
  });
  expect(page).toMatchObject([{ author: "jordan", body: "hello1" }]);
  expect(isDone).toEqual(false);
  await t.run(async (ctx) => {
    await ctx.db.delete(page[0]._id);
  });
  const {
    isDone: isDone2,
    page: page2,
    continueCursor: continueCursor2,
  } = await t.query(api.pagination.listWithCompositeIndex, {
    author: "jordan",
    paginationOptions: {
      cursor: continueCursor,
      numItems: 2,
    },
  });
  expect(page2).toMatchObject([
    { author: "jordan", body: "hello2" },
    { author: "jordan", body: "hello3" },
  ]);
  expect(isDone2).toEqual(false);
  await t.run(async (ctx) => {
    await ctx.db.delete(page2[1]._id);
  });
  const { isDone: isDone3, page: page3 } = await t.query(api.pagination.listWithCompositeIndex, {
    author: "jordan",
    paginationOptions: {
      cursor: continueCursor2,
      numItems: 1,
    },
  });
  expect(page3).toMatchObject([{ author: "jordan", body: "hello4" }]);
  expect(isDone3).toEqual(true);
});

const paginateOnce = (ctx: any) =>
  ctx.db.query("messages").paginate({ cursor: null, numItems: 10 });

test("multiple paginate calls in one function execution throw", async () => {
  const t = convexTest({ schema });
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello" });
  });
  await expect(
    t.query(async (ctx) => {
      await paginateOnce(ctx);
      await paginateOnce(ctx);
    }),
  ).rejects.toThrow(/single paginated query/);
});

test("a single paginate call is allowed", async () => {
  const t = convexTest({ schema });
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello" });
  });
  const { page } = await t.query(async (ctx) => paginateOnce(ctx));
  expect(page).toMatchObject([{ author: "sarah", body: "hello" }]);
});

test("paginate in separate function executions does not throw", async () => {
  const t = convexTest({ schema });
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello" });
  });
  const a = await t.query(async (ctx) => paginateOnce(ctx));
  const b = await t.query(async (ctx) => paginateOnce(ctx));
  expect(a.page.length).toBe(1);
  expect(b.page.length).toBe(1);
});

test("paginate once per nested function via runQuery does not throw", async () => {
  const t = convexTest({ schema });
  await t.run(async (ctx) => {
    await ctx.db.insert("messages", { author: "sarah", body: "hello" });
  });
  const result = await t.action(async (ctx) => {
    const first = await ctx.runQuery(api.pagination.listAll, {
      paginationOptions: { cursor: null, numItems: 10 },
    });
    const second = await ctx.runQuery(api.pagination.listAll, {
      paginationOptions: { cursor: null, numItems: 10 },
    });
    return { first, second };
  });
  expect(result.first.page.length).toBe(1);
  expect(result.second.page.length).toBe(1);
});
