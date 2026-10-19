import { body, idParam, route, type Ctx } from "@/lib/server/http";
import { deleteMilestone, updateMilestone } from "@/lib/server/goals";
import { MilestonePatch } from "@/lib/shared/schemas";

export const PATCH = route(async (req, ctx: Ctx) => updateMilestone(await idParam(ctx), await body(req, MilestonePatch)));
export const DELETE = route(async (_req, ctx: Ctx) => deleteMilestone(await idParam(ctx)));
