import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query(async (ctx) => {
  return await ctx.db.query("messages").collect();
});

export const count = query(async (ctx) => {
  return await (ctx.db.query("messages") as any).count();
});

export const lastN = query({
  args: { count: v.number() },
  handler: async (ctx, args) => {
    const lastMessages = await ctx.db.query("messages").order("desc").take(args.count);
    return lastMessages.reverse();
  },
});

export default query(async (ctx) => {
  return ctx.db.query("messages").collect();
});
