import { body, route } from "@/lib/server/http";
import { reorderTasks } from "@/lib/server/tasks";
import { ReorderInput } from "@/lib/shared/schemas";

export const POST = route(async (req) => reorderTasks((await body(req, ReorderInput)).ids));
