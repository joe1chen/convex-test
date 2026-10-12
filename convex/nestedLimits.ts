import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

const transactionLimitsValidator = v.object({
  bytesRead: v.optional(v.number()),
  bytesWritten: v.optional(v.number()),
  databaseQueries: v.optional(v.number()),
  documentsRead: v.optional(v.number()),
  documentsWritten: v.optional(v.number()),
  functionsScheduled: v.optional(v.number()),
  scheduledFunctionArgsBytes: v.optional(v.number()),
});

export const readAll = query(async (ctx) => {
  const docs = await ctx.db.query("messages").collect();
  return docs.length;
});

export const readN = query({
  args: { n: v.number() },
  handler: async (ctx, { n }) => {
    const docs = await ctx.db.query("messages").take(n);
    return docs.length;
  },
});

export const insertMany = mutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("messages", { author: "child", body: `msg${i}` });
    }
  },
});

export const insertManyThenThrow = mutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("messages", { author: "child", body: `msg${i}` });
    }
    throw new Error("nested boom");
  },
});

export const insertRollbackThenReportMetrics = mutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    try {
      await ctx.runMutation(api.nestedLimits.insertManyThenThrow, { count });
    } catch {}
    const metrics = await ctx.meta.getTransactionMetrics();
    return metrics.documentsWritten.used;
  },
});

export const parentInsertAfterRollback = mutation({
  args: { rolledBackCount: v.number(), keptCount: v.number() },
  handler: async (ctx, { rolledBackCount, keptCount }) => {
    try {
      await ctx.runMutation(api.nestedLimits.insertManyThenThrow, {
        count: rolledBackCount,
      });
    } catch {}
    for (let i = 0; i < keptCount; i++) {
      await ctx.db.insert("messages", { author: "parent", body: `kept${i}` });
    }
  },
});

export const parentReadWithLimits = query({
  args: { transactionLimits: transactionLimitsValidator },
  handler: async (ctx, { transactionLimits }): Promise<number> => {
    return await ctx.runQuery(api.nestedLimits.readAll, {}, { transactionLimits });
  },
});

export const parentReadNoLimits = query(async (ctx): Promise<number> => {
  return await ctx.runQuery(api.nestedLimits.readAll, {});
});

export const parentInsertWithLimits = mutation({
  args: {
    count: v.number(),
    transactionLimits: transactionLimitsValidator,
  },
  handler: async (ctx, { count, transactionLimits }) => {
    await ctx.runMutation(api.nestedLimits.insertMany, { count }, { transactionLimits });
  },
});

export const nestThenReadAll = query({
  args: {
    nestedReadCount: v.number(),
    transactionLimits: transactionLimitsValidator,
  },
  handler: async (ctx, { nestedReadCount, transactionLimits }): Promise<number> => {
    await ctx.runQuery(api.nestedLimits.readN, { n: nestedReadCount }, { transactionLimits });
    const docs = await ctx.db.query("messages").collect();
    return docs.length;
  },
});
