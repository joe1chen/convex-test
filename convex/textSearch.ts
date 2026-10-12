import { v } from "convex/values";
import { query } from "./_generated/server";

export const textSearch = query({
  args: { author: v.union(v.string(), v.null()), body: v.string() },
  handler: async (ctx, { author, body }) => {
    return await ctx.db
      .query("messages")
      .withSearchIndex("body", (q) => {
        const filter = q.search("body", body);
        return author === null ? filter : filter.eq("author", author);
      })
      .collect();
  },
});
