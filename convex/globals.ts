import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";

export const mutationPatchingGlobal = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ before: string; nested: string; after: string }> => {
    const original = globalThis.atob;
    (globalThis as any).atob = () => "patched-by-mutation";
    try {
      const before = globalThis.atob("ignored");

      const nested = await ctx.runQuery(internal.globals.readAtob);

      const after = globalThis.atob("ignored");

      return { before, nested, after };
    } finally {
      (globalThis as any).atob = original;
    }
  },
});

export const readAtob = internalQuery({
  args: {},
  handler: async (): Promise<string> => {
    return globalThis.atob("aGVsbG8=");
  },
});

export const consumeRandom = internalMutation({
  args: {},
  returns: v.number(),
  handler: async () => Math.random(),
});

export const readGlobalType = internalQuery({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (_ctx, { name }) => typeof (globalThis as Record<string, unknown>)[name],
});

export const actionPatchingGlobal = internalAction({
  args: {},
  handler: async (ctx) => {
    (globalThis as any).atob = () => "patched-by-action";

    const before = globalThis.atob("ignored");

    const nested: string = await ctx.runMutation(internal.globals.nestedMutationReadAtob);

    const after = globalThis.atob("ignored");

    return { before, nested, after };
  },
});

export const nestedMutationReadAtob = internalMutation({
  args: {},
  handler: async () => {
    return globalThis.atob("aGVsbG8=");
  },
});

export const actionPatchingGlobalNested = internalAction({
  args: {},
  handler: async (ctx) => {
    (globalThis as any).atob = () => "patched-by-outer";

    const outerBefore = globalThis.atob("ignored");

    const inner: { before: string; after: string } = await ctx.runAction(
      internal.globals.innerActionPatchingGlobal,
    );

    const outerAfter = globalThis.atob("ignored");

    return { outerBefore, inner, outerAfter };
  },
});

export const innerActionPatchingGlobal = internalAction({
  args: {},
  handler: async () => {
    const before = globalThis.atob("aGVsbG8=");

    (globalThis as any).atob = () => "patched-by-inner";
    const after = globalThis.atob("ignored");

    return { before, after };
  },
});

export const actionPatchA = action({
  args: { delayMs: v.number() },
  handler: async () => {
    (globalThis as any).atob = () => "patched-A";

    await new Promise((r) => setTimeout(r, 10));

    return globalThis.atob("ignored");
  },
});

export const actionPatchB = action({
  args: { delayMs: v.number() },
  handler: async () => {
    (globalThis as any).atob = () => "patched-B";

    await new Promise((r) => setTimeout(r, 10));

    return globalThis.atob("ignored");
  },
});

export const readAtobAction = internalAction({
  args: {},
  handler: async () => {
    return globalThis.atob("aGVsbG8=");
  },
});

export const queryUsingFetch = internalQuery({
  args: {},
  handler: async () => {
    await fetch("https://example.com");
    return null;
  },
});

export const mutationUsingFetch = internalMutation({
  args: {},
  handler: async () => {
    await fetch("https://example.com");
    return null;
  },
});

export const mutationUsingSetTimeout = internalMutation({
  args: {},
  handler: async () => {
    setTimeout(() => {}, 0);
    return null;
  },
});

export const queryUsingSetInterval = internalQuery({
  args: {},
  handler: async () => {
    setInterval(() => {}, 0);
    return null;
  },
});

export const mutationOverridingFetch = internalMutation({
  args: {},
  handler: async () => {
    (globalThis as any).fetch = async () => new Response(JSON.stringify({ ok: true }));
    const res = await fetch("https://example.com");
    return await res.text();
  },
});

export const actionUsingSetTimeout = internalAction({
  args: {},
  handler: async () => {
    await new Promise((r) => setTimeout(r, 1));
    return "ok";
  },
});
