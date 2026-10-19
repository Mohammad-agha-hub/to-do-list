import { body, idParam, route, type Ctx } from "@/lib/server/http";
import { addProgressLog } from "@/lib/server/goals";
import { ProgressLogInput } from "@/lib/shared/schemas";

export const POST = route(async (req, ctx: Ctx) => addProgressLog(await idParam(ctx), await body(req, ProgressLogInput)));
