import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

export const queryWithIncompleteReturnValidator = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("messages"),
      author: v.string(),
      body: v.string(),
      embedding: v.optional(v.array(v.number())),
      score: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("messages").first();
  },
});

export const queryWithCorrectReturnValidator = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      author: v.string(),
      body: v.string(),
      embedding: v.optional(v.array(v.number())),
      score: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("messages").first();
  },
});

export const queryReturningNumber = query({
  args: {},
  returns: v.number(),
  handler: async () => {
    return 42;
  },
});

export const queryReturningWrongType = query({
  args: {},
  returns: v.string(),
  handler: async (): Promise<any> => {
    return 42;
  },
});

export const mutationWithIncompleteReturnValidator = mutation({
  args: { author: v.string(), body: v.string() },
  returns: v.object({
    _id: v.id("messages"),
    author: v.string(),
    body: v.string(),
    embedding: v.optional(v.array(v.number())),
    score: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", args);
    return (await ctx.db.get(id))!;
  },
});

export const mutationWithCorrectReturnValidator = mutation({
  args: { author: v.string(), body: v.string() },
  returns: v.object({
    _id: v.id("messages"),
    _creationTime: v.number(),
    author: v.string(),
    body: v.string(),
    embedding: v.optional(v.array(v.number())),
    score: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", args);
    return (await ctx.db.get(id))!;
  },
});

export const queryWithoutReturnValidator = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").first();
  },
});

export const queryReturningArrayWithIncompleteValidator = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      author: v.string(),
      body: v.string(),
      embedding: v.optional(v.array(v.number())),
      score: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});

export const actionWithIncompleteReturnValidator = action({
  args: {},
  returns: v.object({
    name: v.string(),
  }),
  handler: async () => {
    return { name: "test", extraField: "unexpected" } as { name: string };
  },
});

export const actionWithCorrectReturnValidator = action({
  args: {},
  returns: v.object({
    name: v.string(),
    value: v.number(),
  }),
  handler: async () => {
    return { name: "test", value: 42 };
  },
});
