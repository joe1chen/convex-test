/// <reference types="vite/client" />

import { type AnyComponents, componentsGeneric } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "../index";
import { api, components, internal } from "./_generated/api";
import counterSchema from "./counter/component/schema";
import schema from "./schema";
import { keepReschedulingReference } from "./settleScheduledFunctions";

const counterModules = import.meta.glob("./counter/component/**/*.ts");
const counterFixtures = (componentsGeneric() as AnyComponents).counter.settle;

function realDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("fork: settleScheduledFunctions with fake timers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("fork: a pending function in the app is cancelled and its timer never fires", async () => {
    const t = convexTest(schema);
    const id = await t.mutation(api.scheduler.mutationSchedulingAction, {
      delayMs: 10_000,
      body: "never runs",
    });
    expect(vi.getTimerCount()).toBe(1);

    await t.settleScheduledFunctions();

    expect(vi.getTimerCount()).toBe(0);
    expect(await t.query(internal.scheduler.jobs)).toMatchObject([
      { _id: id, state: { kind: "canceled" } },
    ]);
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(internal.scheduler.list)).toEqual([]);
  });

  test("fork: a pending function in a component is cancelled and its timer never fires", async () => {
    const t = convexTest(schema);
    t.registerComponent("counter", counterSchema, counterModules);
    await t.mutation(components.counter.public.schedule, { name: "never runs" });
    expect(await t.query(counterFixtures.scheduledFunctions, {})).toMatchObject([
      { state: { kind: "pending" } },
    ]);

    await t.settleScheduledFunctions();

    expect(vi.getTimerCount()).toBe(0);
    expect(await t.query(counterFixtures.scheduledFunctions, {})).toMatchObject([
      { state: { kind: "canceled" } },
    ]);
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(components.counter.public.count, { name: "never runs" })).toBe(0);
  });

  test("fork: a function cancelled earlier stays cancelled and its timer is cleared", async () => {
    const t = convexTest(schema);
    const id = await t.mutation(api.scheduler.mutationSchedulingAction, {
      delayMs: 10_000,
      body: "cancelled by the test",
    });
    await t.mutation(api.scheduler.cancel, { id });

    await t.settleScheduledFunctions();

    expect(vi.getTimerCount()).toBe(0);
    expect(await t.query(internal.scheduler.jobs)).toMatchObject([
      { _id: id, state: { kind: "canceled" } },
    ]);
  });

  test("fork: an instance at rest settles without an iteration, as often as it is asked", async () => {
    const t = convexTest(schema);
    await t.settleScheduledFunctions(0);

    await t.mutation(api.scheduler.mutationSchedulingAction, { delayMs: 10_000, body: "once" });
    await t.settleScheduledFunctions();
    const settled = await t.query(internal.scheduler.jobs);
    await t.settleScheduledFunctions(0);

    expect(await t.query(internal.scheduler.jobs)).toEqual(settled);
  });
});

describe("fork: settleScheduledFunctions with real timers", () => {
  test("fork: a function in progress is awaited, not cancelled", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingActionWithTimeout, { body: "finished" });
    await realDelay(20);
    expect(await t.query(internal.scheduler.jobs)).toMatchObject([
      { state: { kind: "inProgress" } },
    ]);

    await t.settleScheduledFunctions();

    expect(await t.query(internal.scheduler.jobs)).toMatchObject([{ state: { kind: "success" } }]);
    expect(await t.query(internal.scheduler.list)).toMatchObject([{ body: "finished" }]);
  });

  test("fork: functions that keep starting more while they run throw after maxIterations", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.scheduler.runAfter(0, keepReschedulingReference, { remaining: 5 });
    });
    await realDelay(5);

    await expect(t.settleScheduledFunctions(3)).rejects.toThrow(
      "scheduled functions still running after 3 iterations",
    );

    await t.settleScheduledFunctions();
    const states = (await t.query(internal.scheduler.jobs)).map((job) => job.state.kind);
    expect(states.filter((state) => state === "success").length).toBeGreaterThanOrEqual(4);
    expect(states.every((state) => state === "success" || state === "canceled")).toBe(true);
  });
});
