import { route } from "@/lib/server/http";
import { ensureDay } from "@/lib/server/day";
import { listAreas } from "@/lib/server/areas";
import { listGoalRows } from "@/lib/server/goals";
import { getSettings } from "@/lib/server/settings";
import type { Bootstrap } from "@/lib/shared/types";

export const GET = route(async (): Promise<Bootstrap> => {
  const [today, areas, goals, settings] = await Promise.all([ensureDay(), listAreas(), listGoalRows(), getSettings()]);
  return { today, areas, goals, settings };
});
