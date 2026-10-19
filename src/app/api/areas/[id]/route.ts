import { body, idParam, route, type Ctx } from "@/lib/server/http";
import { deleteArea, updateArea } from "@/lib/server/areas";
import { AreaPatch } from "@/lib/shared/schemas";

export const PATCH = route(async (req, ctx: Ctx) => updateArea(await idParam(ctx), await body(req, AreaPatch)));
export const DELETE = route(async (_req, ctx: Ctx) => deleteArea(await idParam(ctx)));
