import { body, idParam, route, type Ctx } from "@/lib/server/http";
import { deleteGoal, goalDetail, updateGoal } from "@/lib/server/goals";
import { GoalPatch } from "@/lib/shared/schemas";

export const GET = route(async (_req, ctx: Ctx) => goalDetail(await idParam(ctx)));
export const PATCH = route(async (req, ctx: Ctx) => updateGoal(await idParam(ctx), await body(req, GoalPatch)));
export const DELETE = route(async (_req, ctx: Ctx) => deleteGoal(await idParam(ctx)));
