import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

export const listFiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.system.query("_storage").collect();
  },
});

export const actionStoreBlob = internalAction({
  args: {
    bytes: v.bytes(),
  },
  handler: async (ctx, { bytes }) => {
    return await ctx.storage.store(new Blob([bytes]));
  },
});

export const actionGetBlob = internalAction({
  args: {
    id: v.id("_storage"),
  },
  handler: async (ctx, { id }) => {
    return (await ctx.storage.get(id))?.arrayBuffer();
  },
});

export const actionDeleteBlob = internalAction({
  args: {
    id: v.id("_storage"),
  },
  handler: async (ctx, { id }) => {
    await ctx.storage.delete(id);
  },
});

export const mutationDeleteBlob = internalMutation({
  args: {
    id: v.id("_storage"),
  },
  handler: async (ctx, { id }) => {
    await ctx.storage.delete(id);
  },
});

export const queryGetUrl = internalQuery({
  args: {
    id: v.id("_storage"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.storage.getUrl(id);
  },
});

export const mutationGenerateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
