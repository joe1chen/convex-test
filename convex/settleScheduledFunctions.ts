import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "./_generated/server";

const HALF_A_GENERATION_MS = 20;

function sleepHalfAGeneration(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, HALF_A_GENERATION_MS));
}

export const keepReschedulingReference = makeFunctionReference<"action", { remaining: number }>(
  "settleScheduledFunctions:keepRescheduling",
);

export const keepRescheduling = action({
  args: { remaining: v.number() },
  handler: async (ctx, { remaining }) => {
    await sleepHalfAGeneration();
    if (remaining > 0) {
      await ctx.scheduler.runAfter(0, keepReschedulingReference, { remaining: remaining - 1 });
    }
    await sleepHalfAGeneration();
  },
});
