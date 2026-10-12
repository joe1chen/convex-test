import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  action,
  type ActionCtx,
  internalAction,
  internalQuery,
  mutation,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});

export const add = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, { body, author }) => {
    const message = { body, author };
    await ctx.db.insert("messages", message);
  },
});

export const actionCallingQuery = internalAction({
  args: {},
  handler: async (ctx) => {
    const result: Doc<"messages">[] = await ctx.runQuery(internal.actions.list, {});
    return result;
  },
});

export const actionCallingMutation = action({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    await ctx.runMutation(api.actions.add, { body, author: "AI" });
  },
});

export const actionCallingAction = internalAction({
  args: { count: v.number() },
  handler: actionCallingActionHandler,
});
export async function actionCallingActionHandler(ctx: ActionCtx, { count }: { count: number }) {
  if (count > 0) {
    const result: { called: number } = await ctx.runAction(internal.actions.actionCallingAction, {
      count: count - 1,
    });
    return { called: result.called + 1 };
  }
  return { called: 0 };
}

export const actionCallingMutationsConcurrently = action({
  args: { authors: v.array(v.string()), body: v.string() },
  handler: async (ctx, { authors, body }) => {
    await Promise.all(
      authors.map(async (author) => {
        return await ctx.runMutation(api.actions.add, { body, author });
      }),
    );
  },
});
