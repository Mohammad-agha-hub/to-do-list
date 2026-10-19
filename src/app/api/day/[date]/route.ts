import { body, HttpError, route } from "@/lib/server/http";
import { getDayLog, saveDayLog } from "@/lib/server/day";
import { DayLogInput } from "@/lib/shared/schemas";

type DateCtx = { params: Promise<{ date: string }> };

async function dateParam(ctx: DateCtx) {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Bad date");
  return date;
}

export const GET = route(async (_req, ctx: DateCtx) => getDayLog(await dateParam(ctx)));
export const PUT = route(async (req, ctx: DateCtx) => saveDayLog(await dateParam(ctx), await body(req, DayLogInput)));
