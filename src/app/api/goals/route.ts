import { body, route } from "@/lib/server/http";
import { createGoal, listGoals } from "@/lib/server/goals";
import { ensureDay } from "@/lib/server/day";
import { GoalInput } from "@/lib/shared/schemas";

export const GET = route(() => listGoals(ensureDay()));
export const POST = route(async (req) => createGoal(await body(req, GoalInput)));
