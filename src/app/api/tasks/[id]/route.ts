import { body, idParam, route, type Ctx } from "@/lib/server/http";
import { deleteTask, getTask, updateTask } from "@/lib/server/tasks";
import { TaskPatch } from "@/lib/shared/schemas";

export const GET = route(async (_req, ctx: Ctx) => getTask(await idParam(ctx)));
export const PATCH = route(async (req, ctx: Ctx) => updateTask(await idParam(ctx), await body(req, TaskPatch)));
export const DELETE = route(async (_req, ctx: Ctx) => deleteTask(await idParam(ctx)));
