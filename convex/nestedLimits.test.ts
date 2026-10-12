import { expect, test } from "vitest";
import { convexTest } from "../index";
import { api } from "./_generated/api";
import schema from "./schema";

const MiB = 1 << 20;

async function seed(t: ReturnType<typeof convexTest>, count: number) {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("messages", { author: "sarah", body: `msg${i}` });
    }
  });
}

test("nested runQuery enforces its own documentsRead limit", async () => {
  const t = convexTest({ schema });
  await seed(t, 10);
  await expect(
    t.query(api.nestedLimits.parentReadWithLimits, {
      transactionLimits: { documentsRead: 5 },
    }),
  ).rejects.toThrow(/Scanned too many documents/);
});

test("nested runQuery under its limit succeeds", async () => {
  const t = convexTest({ schema });
  await seed(t, 3);
  const count = await t.query(api.nestedLimits.parentReadWithLimits, {
    transactionLimits: { documentsRead: 5 },
  });
  expect(count).toBe(3);
});

test("nested runMutation enforces its own documentsWritten limit", async () => {
  const t = convexTest({ schema });
  await expect(
    t.mutation(api.nestedLimits.parentInsertWithLimits, {
      count: 10,
      transactionLimits: { documentsWritten: 3 },
    }),
  ).rejects.toThrow(/Wrote too many documents/);
});

test("nested runMutation under its limit succeeds", async () => {
  const t = convexTest({ schema });
  await t.mutation(api.nestedLimits.parentInsertWithLimits, {
    count: 2,
    transactionLimits: { documentsWritten: 5 },
  });
  const count = await t.query(api.nestedLimits.readAll, {});
  expect(count).toBe(2);
});

test("nested limits cannot raise above the global limit", async () => {
  const t = convexTest({
    schema,
    transactionLimits: { documentsRead: 5 },
  });
  await seed(t, 10);
  await expect(
    t.query(api.nestedLimits.parentReadWithLimits, {
      transactionLimits: { documentsRead: 100_000 },
    }),
  ).rejects.toThrow(/Scanned too many documents/);
});

test("global limit still applies when the nested limit is looser", async () => {
  const t = convexTest({
    schema,
    transactionLimits: { documentsRead: 5 },
  });
  await seed(t, 10);
  await expect(
    t.query(api.nestedLimits.parentReadWithLimits, {
      transactionLimits: { documentsRead: 8 },
    }),
  ).rejects.toThrow(/Scanned too many documents/);
});

test("nested limit does not leak to the parent transaction", async () => {
  const t = convexTest({
    schema,
    transactionLimits: { documentsRead: 100, bytesRead: 16 * MiB },
  });
  await seed(t, 10);
  const count = await t.query(api.nestedLimits.nestThenReadAll, {
    nestedReadCount: 2,
    transactionLimits: { documentsRead: 3 },
  });
  expect(count).toBe(10);
});

test("rolled-back nested writes are not counted against the transaction", async () => {
  const t = convexTest({ schema });
  const documentsWritten = await t.mutation(api.nestedLimits.insertRollbackThenReportMetrics, {
    count: 5,
  });
  expect(documentsWritten).toBe(0);
  const count = await t.query(api.nestedLimits.readAll, {});
  expect(count).toBe(0);
});

test("rolled-back nested writes do not consume the global write limit", async () => {
  const t = convexTest({
    schema,
    transactionLimits: { documentsWritten: 5 },
  });
  await t.mutation(api.nestedLimits.parentInsertAfterRollback, {
    rolledBackCount: 4,
    keptCount: 4,
  });
  const count = await t.query(api.nestedLimits.readAll, {});
  expect(count).toBe(4);
});

test("nested transactionLimits is optional", async () => {
  const t = convexTest({ schema });
  await seed(t, 10);
  const count = await t.query(api.nestedLimits.parentReadNoLimits, {});
  expect(count).toBe(10);
});
