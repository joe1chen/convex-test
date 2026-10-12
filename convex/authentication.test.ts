import { expect, test, describe, vi } from "vitest";
import { convexTest, type TestConvexForDataModel } from "../index";
import schema from "./schema";
import { api } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

test("generated attributes", async () => {
  const t = convexTest(schema);
  const asSarah = t.withIdentity({ name: "Sarah" });
  const attributes = await asSarah.run((ctx) => {
    return ctx.auth.getUserIdentity();
  });
  expect(attributes).toMatchObject({ name: "Sarah" });
  expect(attributes!.tokenIdentifier).toBeTypeOf("string");
  expect(attributes!.subject).toBeTypeOf("string");
  expect(attributes!.issuer).toBeTypeOf("string");
});
test("accessors are immutable", async () => {
  const t = convexTest(schema);
  const asSarah = t.withIdentity({ name: "Sarah" });
  const asMichal = asSarah.withIdentity({ name: "Michal" });
  const identity = (t: TestConvexForDataModel<DataModel>) =>
    t.run((ctx) => ctx.auth.getUserIdentity());
  expect(await identity(asMichal)).toMatchObject({ name: "Michal" });
  expect(await identity(asSarah)).toMatchObject({ name: "Sarah" });
  expect(await identity(t)).toEqual(null);
});

async function runTest(fn: (t: TestConvexForDataModel<DataModel>) => Promise<string | null>) {
  const t = convexTest(schema);
  const asSarah = t.withIdentity({ name: "Sarah" });
  const name = await fn(asSarah);
  expect(name).toEqual("Sarah");
}

describe("action auth", () => {
  test("action directly", async () => {
    await runTest((t) => t.action(api.authentication.actionName));
  });
  test("action inline", async () => {
    await runTest((t) => t.action(async (ctx) => (await ctx.auth.getUserIdentity())?.name ?? null));
  });
  test("action calling query", async () => {
    await runTest((t) => t.action(api.authentication.actionCallingQuery));
  });
  test("action calling mutation", async () => {
    await runTest((t) => t.action(api.authentication.actionCallingMutation));
  });
  test("action calling action", async () => {
    await runTest((t) => t.action(api.authentication.actionCallingAction));
  });
  test("action calling action calling query", async () => {
    await runTest((t) => t.action(api.authentication.actionCallingActionCallingQuery));
  });
});

describe("mutation auth", () => {
  test("mutation directly", async () => {
    await runTest((t) => t.mutation(api.authentication.mutationName));
  });
  test("mutation inline", async () => {
    await runTest((t) =>
      t.mutation(async (ctx) => (await ctx.auth.getUserIdentity())?.name ?? null),
    );
  });
  test("mutation calling query", async () => {
    await runTest((t) => t.mutation(api.authentication.mutationCallingQuery));
  });
  test("mutation calling mutation", async () => {
    await runTest((t) => t.mutation(api.authentication.mutationCallingMutation));
  });
  test("mutation calling mutation calling query", async () => {
    await runTest((t) => t.mutation(api.authentication.mutationCallingMutationCallingQuery));
  });
});

describe("query auth", () => {
  test("query directly", async () => {
    await runTest((t) => t.query(api.authentication.queryName));
  });
  test("query inline", async () => {
    await runTest((t) => t.query(async (ctx) => (await ctx.auth.getUserIdentity())?.name ?? null));
  });
  test("query calling query", async () => {
    await runTest((t) => t.query(api.authentication.queryCallingQuery));
  });
});

test("scheduled function does not receive auth", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema);
  const asSarah = t.withIdentity({ name: "Sarah" });
  const scheduled = await asSarah.mutation(api.authentication.scheduledNoAuth);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const result = await t.query((ctx) => ctx.db.system.get("_scheduled_functions", scheduled));
  expect(result?.state.kind).toBe("success");

  vi.useRealTimers();
});
