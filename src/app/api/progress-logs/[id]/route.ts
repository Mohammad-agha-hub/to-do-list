import { idParam, route, type Ctx } from "@/lib/server/http";
import { deleteProgressLog } from "@/lib/server/goals";

export const DELETE = route(async (_req, ctx: Ctx) => deleteProgressLog(await idParam(ctx)));
