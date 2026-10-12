import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalQuery } from "./_generated/server";

export const get = internalQuery({
  args: { id: v.id("messages") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) {
      throw new Error("not found: " + id);
    }
    return doc;
  },
});

export const vectorSearch = action({
  args: {
    author: v.union(v.string(), v.null()),
    embedding: v.array(v.number()),
    limit: v.number(),
  },
  handler: async (
    ctx,
    { author, embedding, limit },
  ): Promise<Array<Doc<"messages"> & { score: number }>> => {
    const results = await ctx.vectorSearch("messages", "embedding", {
      vector: embedding,
      filter: author === null ? undefined : (q) => q.eq("author", author),
      limit,
    });
    return Promise.all(
      results.map(async ({ _id, _score }) => {
        const doc: Doc<"messages"> = await ctx.runQuery(internal.vectorSearch.get, { id: _id });
        return {
          ...doc,
          score: _score,
        };
      }),
    );
  },
});
