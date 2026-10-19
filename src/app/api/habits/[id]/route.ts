import { body, idParam, route, type Ctx } from "@/lib/server/http";
import { deleteHabit, updateHabit } from "@/lib/server/habits";
import { HabitPatch } from "@/lib/shared/schemas";

export const PATCH = route(async (req, ctx: Ctx) => updateHabit(await idParam(ctx), await body(req, HabitPatch)));
export const DELETE = route(async (_req, ctx: Ctx) => deleteHabit(await idParam(ctx)));
