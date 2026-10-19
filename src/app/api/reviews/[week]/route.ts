import { z } from "zod";
import { body, HttpError, route } from "@/lib/server/http";
import { reviewData, saveReview } from "@/lib/server/review";
import { WeeklyReviewInput } from "@/lib/shared/schemas";
import { weekday } from "@/lib/shared/dates";

type WeekCtx = { params: Promise<{ week: string }> };

async function weekParam(ctx: WeekCtx) {
  const { week } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || weekday(week) !== 1) throw new HttpError(400, "Week must start on a Monday");
  return week;
}

const SaveInput = WeeklyReviewInput.extend({ complete: z.boolean().default(false) });

export const GET = route(async (_req, ctx: WeekCtx) => reviewData(await weekParam(ctx)));
export const PUT = route(async (req, ctx: WeekCtx) => {
  const { complete, ...fields } = await body(req, SaveInput);
  return saveReview(await weekParam(ctx), fields, complete);
});
