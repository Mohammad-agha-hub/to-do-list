import { body, idParam, route, type Ctx } from "@/lib/server/http";
import { createMilestone } from "@/lib/server/goals";
import { MilestoneInput } from "@/lib/shared/schemas";

export const POST = route(async (req, ctx: Ctx) => createMilestone(await idParam(ctx), await body(req, MilestoneInput)));
