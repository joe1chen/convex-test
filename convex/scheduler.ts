import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});

export const add = mutation({
  args: {
    body: v.string(),
    author: v.string(),
    bigint: v.optional(v.int64()),
  },
  handler: async (ctx, { body, author }) => {
    if (body === "FAIL THIS") {
      throw new Error("failed as intended");
    }
    const message = { body, author };
    await ctx.db.insert("messages", message);
  },
});

export const actionCallingMutation = action({
  args: { body: v.string(), bigint: v.optional(v.int64()) },
  handler: async (ctx, { body, bigint }) => {
    await ctx.runMutation(api.scheduler.add, { body, author: "AI", bigint });
  },
});

export const jobs = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.system.query("_scheduled_functions").collect();
  },
});

export const mutationSchedulingAction = mutation({
  args: {
    body: v.string(),
    delayMs: v.number(),
    bigint: v.optional(v.int64()),
  },
  handler: async (ctx, { body, delayMs, bigint }) => {
    const id: Id<"_scheduled_functions"> = await ctx.scheduler.runAfter(
      delayMs,
      api.scheduler.actionCallingMutation,
      { body, bigint },
    );
    return id;
  },
});

export const cancel = mutation({
  args: { id: v.id("_scheduled_functions") },
  handler: async (ctx, { id }) => {
    await ctx.scheduler.cancel(id);
  },
});

export const actionSchedulingAction = action({
  args: { body: v.string(), delayMs: v.number() },
  handler: async (ctx, { body, delayMs }) => {
    const id: Id<"_scheduled_functions"> = await ctx.scheduler.runAfter(
      delayMs,
      api.scheduler.actionCallingMutation,
      { body },
    );
    return id;
  },
});

export const cancelAction = action({
  args: { id: v.id("_scheduled_functions") },
  handler: async (ctx, { id }) => {
    await ctx.scheduler.cancel(id);
  },
});

export const actionSchedulingActionNTimes = action({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    await ctx.runMutation(api.scheduler.add, {
      body: `count ${count}`,
      author: "AI",
    });
    if (count > 0) {
      await ctx.scheduler.runAfter(0, api.scheduler.actionSchedulingActionNTimes, {
        count: count - 1,
      });
    }
  },
});

export const actionWithInternalSetTimeout = action({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    await ctx.runMutation(api.scheduler.add, { body, author: "AI" });
  },
});

export const mutationSchedulingActionWithTimeout = mutation({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    await ctx.scheduler.runAfter(0, api.scheduler.actionWithInternalSetTimeout, { body });
  },
});

export const selfSchedulingMutation = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(1000, api.scheduler.selfSchedulingMutation, {});
  },
});

export const scheduleNowAndLater = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, api.scheduler.add, {
      body: "immediate",
      author: "AI",
    });
    await ctx.scheduler.runAfter(60_000, api.scheduler.add, {
      body: "delayed",
      author: "AI",
    });
  },
});

export const childSchedulesAdd = mutation({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    await ctx.scheduler.runAfter(0, api.scheduler.add, { body, author: "AI" });
  },
});

export const parentRunsMutationThatSchedules = mutation({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    await ctx.runMutation(api.scheduler.childSchedulesAdd, { body });
  },
});

export const actionSchedulesMutationAndPolls = action({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    await ctx.scheduler.runAfter(0, api.scheduler.add, { body, author: "AI" });
    for (let i = 0; i < 100; i++) {
      const messages = await ctx.runQuery(api.scheduler.listPublic, {});
      if (messages.some((m) => m.body === body)) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("polled too long without seeing scheduled mutation");
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});
