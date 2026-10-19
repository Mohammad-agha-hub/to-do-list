import { route } from "@/lib/server/http";
import { ensureDay } from "@/lib/server/day";
import { listAreas } from "@/lib/server/areas";
import { listGoalRows } from "@/lib/server/goals";
import { getSettings } from "@/lib/server/settings";
import type { Bootstrap } from "@/lib/shared/types";

export const GET = route((): Bootstrap => ({
  today: ensureDay(),
  areas: listAreas(),
  goals: listGoalRows(),
  settings: getSettings(),
}));
