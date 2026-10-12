import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "../index";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const realSetTimeout = globalThis.setTimeout;

async function blockedScheduledFunction() {
  let notifyLoading!: () => void;
  const loading = new Promise<void>((resolve) => {
    notifyLoading = resolve;
  });
  const t = convexTest(schema, {
    ...modules,
    "./scheduler.ts": () => {
      notifyLoading();
      return new Promise<never>(() => {});
    },
  });
  await t.mutation(async (ctx) => {
    await ctx.scheduler.runAfter(0, api.scheduler.add, {
      body: "blocked module load",
      author: "AI",
    });
  });
  return { t, loading };
}

describe("with fake timers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("mutation scheduling action", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingAction, {
      delayMs: 10_000,
      body: "through scheduler",
    });
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([
        { state: { kind: "pending" }, args: [{ body: "through scheduler" }] },
      ]);
    }

    vi.advanceTimersByTime(5000);

    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([{ state: { kind: "pending" } }]);
    }

    vi.runAllTimers();

    await t.finishInProgressScheduledFunctions();

    const result = await t.query(internal.scheduler.list);
    expect(result).toMatchObject([{ body: "through scheduler", author: "AI" }]);
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([{ state: { kind: "success" } }]);
    }
  });

  test("mutation scheduling action then mutation fails", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingAction, {
      delayMs: 10_000,
      body: "through scheduler",
    });
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([{ state: { kind: "success" } }]);
    }
    try {
      await t.mutation(api.scheduler.add, { body: "FAIL THIS", author: "AI" });
    } catch (e: any) {
      expect(e.message).toBe("failed as intended");
    }
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([{ state: { kind: "success" } }]);
    }
  });

  test("cancel mutation", async () => {
    const t = convexTest(schema);
    const id = await t.mutation(api.scheduler.mutationSchedulingAction, {
      body: "through scheduler",
      delayMs: 10_000,
    });
    await t.mutation(api.scheduler.cancel, { id });
    const jobs = await t.query(internal.scheduler.jobs);
    expect(jobs).toMatchObject([{ state: { kind: "canceled" } }]);

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    const result = await t.query(internal.scheduler.list);
    expect(result).toMatchObject([]);
  });

  test("action scheduling action", async () => {
    const t = convexTest(schema);
    await t.action(api.scheduler.actionSchedulingAction, {
      delayMs: 0,
      body: "through scheduler",
    });
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([
        { state: { kind: "pending" }, args: [{ body: "through scheduler" }] },
      ]);
    }

    vi.runAllTimers();

    await t.finishInProgressScheduledFunctions();

    const result = await t.query(internal.scheduler.list);
    expect(result).toMatchObject([{ body: "through scheduler", author: "AI" }]);
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([{ state: { kind: "success" } }]);
    }
  });

  test("action scheduling action many times", async () => {
    const t = convexTest(schema);
    await t.action(api.scheduler.actionSchedulingActionNTimes, {
      count: 10,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const result = (await t.query(internal.scheduler.list)).at(-1);
    expect(result).toMatchObject({ body: "count 0", author: "AI" });
  });

  test("cancel action", async () => {
    const t = convexTest(schema);
    const id = await t.action(api.scheduler.actionSchedulingAction, {
      body: "through scheduler",
      delayMs: 10_000,
    });
    await t.action(api.scheduler.cancelAction, { id });
    const jobs = await t.query(internal.scheduler.jobs);
    expect(jobs).toMatchObject([{ state: { kind: "canceled" } }]);

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    const result = await t.query(internal.scheduler.list);
    expect(result).toMatchObject([]);
  });

  test("failed scheduled function", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingAction, {
      delayMs: 0,
      body: "FAIL THIS",
    });
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    const jobs = await t.query(internal.scheduler.jobs);
    expect(jobs).toMatchObject([{ state: { kind: "failed" }, args: [{ body: "FAIL THIS" }] }]);
  });

  test("self-scheduling mutation", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.selfSchedulingMutation, {});

    await expect(t.finishAllScheduledFunctions(vi.runAllTimers)).rejects.toThrowError(
      /Check for infinitely recursive scheduled functions/,
    );
  });

  test("scheduled action that uses setTimeout internally", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingActionWithTimeout, {
      body: "delayed action",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const result = await t.query(internal.scheduler.list);
    expect(result).toMatchObject([{ body: "delayed action", author: "AI" }]);
  });

  test("stops advancing timers when the original fake clock is replaced", async () => {
    const { t, loading } = await blockedScheduledFunction();
    const outcome = t.finishAllScheduledFunctions(vi.runAllTimers).catch((error) => error);
    await loading;

    vi.useRealTimers();
    vi.useFakeTimers();
    const nextTestTimer = vi.fn();
    setTimeout(nextTestTimer, 60_000);

    await new Promise<void>((resolve) => realSetTimeout(resolve, 20));

    expect(nextTestTimer).not.toHaveBeenCalled();
    expect(await outcome).toMatchObject({
      message: expect.stringContaining("timers were restored or replaced"),
    });
  });

  test("stops pumping when advanceTimers throws", async () => {
    const { t, loading } = await blockedScheduledFunction();
    const reason = new Error("cannot advance timers");
    const advanceTimers = vi.fn(vi.runAllTimers);
    const outcome = t.finishAllScheduledFunctions(advanceTimers).catch((error) => error);
    await loading;
    advanceTimers.mockImplementation(() => {
      throw reason;
    });

    expect(await outcome).toBe(reason);
    advanceTimers.mockClear();

    await new Promise<void>((resolve) => realSetTimeout(resolve, 20));

    expect(advanceTimers).not.toHaveBeenCalled();
  });

  test("new convexTest after orphaned scheduled functions", async () => {
    const t1 = convexTest(schema);
    await t1.mutation(api.scheduler.mutationSchedulingAction, {
      body: "orphaned",
      delayMs: 0,
    });
    vi.runAllTimers();

    vi.useRealTimers();
    const t2 = convexTest(schema);
    await t2.mutation(api.scheduler.add, { body: "fresh", author: "test" });
    const result = await t2.query(internal.scheduler.list);
    expect(result).toMatchObject([{ body: "fresh", author: "test" }]);
  });

  test("advancing time fires only jobs whose scheduledTime has arrived", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.scheduleNowAndLater, {});

    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();

    expect(await t.query(internal.scheduler.list)).toMatchObject([{ body: "immediate" }]);
    const jobs = await t.query(internal.scheduler.jobs);
    expect(
      jobs.filter((j: { state: { kind: string } }) => j.state.kind === "pending"),
    ).toHaveLength(1);
    expect(
      jobs.filter((j: { state: { kind: string } }) => j.state.kind === "success"),
    ).toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(internal.scheduler.list)).toMatchObject([
      { body: "immediate" },
      { body: "delayed" },
    ]);
  });

  test("scheduled functions don't fire until time advances", async () => {
    const t = convexTest(schema);

    await t.mutation(api.scheduler.mutationSchedulingAction, {
      body: "scheduled",
      delayMs: 0,
    });

    const jobsBefore = await t.query(internal.scheduler.jobs);
    expect(jobsBefore).toMatchObject([{ state: { kind: "pending" } }]);

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    const jobsAfter = await t.query(internal.scheduler.jobs);
    expect(jobsAfter).toMatchObject([{ state: { kind: "success" } }]);
  });

  test("scheduled mutations serialize after the parent commits", async () => {
    const t = convexTest(schema);
    await t.mutation(async (ctx) => {
      await ctx.scheduler.runAfter(0, api.scheduler.add, {
        body: "A-scheduled",
        author: "AI",
      });
      await ctx.db.insert("messages", { body: "B-parent-after", author: "ME" });
    });
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    const messages = await t.query(internal.scheduler.list);
    expect(messages.map((m: { body: string }) => m.body)).toEqual([
      "B-parent-after",
      "A-scheduled",
    ]);
  });

  test("rollback cancels scheduled function", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(async (ctx) => {
        await ctx.scheduler.runAfter(0, api.scheduler.add, {
          body: "should-not-run",
          author: "AI",
        });
        throw new Error("rollback");
      }),
    ).rejects.toThrowError(/rollback/);

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    const messages = await t.query(internal.scheduler.list);
    expect(messages).toEqual([]);
    const jobs = await t.query(internal.scheduler.jobs);
    expect(jobs).toEqual([]);
  });

  test("scheduling from a nested mutation still runs as top-level", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.parentRunsMutationThatSchedules, {
      body: "from-nested",
    });
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();
    const messages = await t.query(internal.scheduler.list);
    expect(messages.map((m: { body: string }) => m.body)).toEqual(["from-nested"]);
  });

  test("argument serialization", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingAction, {
      delayMs: 10_000,
      body: "through scheduler",
      bigint: BigInt(1),
    });
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([
        {
          state: { kind: "pending" },
          args: [{ body: "through scheduler", bigint: BigInt(1) }],
        },
      ]);
    }

    vi.advanceTimersByTime(5000);

    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([{ state: { kind: "pending" } }]);
    }

    vi.runAllTimers();

    await t.finishInProgressScheduledFunctions();

    const result = await t.query(internal.scheduler.list);
    expect(result).toMatchObject([{ body: "through scheduler", author: "AI" }]);
    {
      const jobs = await t.query(internal.scheduler.jobs);
      expect(jobs).toMatchObject([{ state: { kind: "success" } }]);
    }
  });
});

describe("with real timers", () => {
  test("action can schedule a mutation and poll for its effect without finish*", async () => {
    const t = convexTest(schema);
    await t.action(api.scheduler.actionSchedulesMutationAndPolls, {
      body: "polled",
    });
    const messages = await t.query(internal.scheduler.list);
    expect(messages.map((m: { body: string }) => m.body)).toEqual(["polled"]);
  });

  test("finishInProgressScheduledFunctions awaits work after the setTimeout fires", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingAction, {
      body: "real-timer",
      delayMs: 0,
    });
    await new Promise((r) => setTimeout(r, 10));
    await t.finishInProgressScheduledFunctions();
    const messages = await t.query(internal.scheduler.list);
    expect(messages).toMatchObject([{ body: "real-timer", author: "AI" }]);
  });
});

describe("scheduled under real timers, drained under fake timers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("finishAllScheduledFunctions drains functions scheduled under real timers", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.childSchedulesAdd, { body: "outbox" });

    vi.useFakeTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    const messages = await t.query(internal.scheduler.list);
    expect(messages).toHaveLength(1);
  });

  test("finishAllScheduledFunctions skips far-future functions scheduled under real timers", async () => {
    const t = convexTest(schema);
    await t.mutation(api.scheduler.mutationSchedulingAction, {
      delayMs: 60_000,
      body: "never runs",
    });

    vi.useFakeTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    const jobs = await t.query(internal.scheduler.jobs);
    expect(jobs).toMatchObject([{ state: { kind: "pending" } }]);
  });
});
