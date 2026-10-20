import { body, route } from "@/lib/server/http";
import { createHabit, listHabits } from "@/lib/server/habits";
import { ensureDay } from "@/lib/server/day";
import { HabitInput } from "@/lib/shared/schemas";

export const GET = route(async () => listHabits(await ensureDay()));
export const POST = route(async (req) => {
  await ensureDay();
  return createHabit(await body(req, HabitInput));
});
