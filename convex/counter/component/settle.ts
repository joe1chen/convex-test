import { query } from "./_generated/server";

export const scheduledFunctions = query({
  args: {},
  handler: (ctx) => ctx.db.system.query("_scheduled_functions").collect(),
});
