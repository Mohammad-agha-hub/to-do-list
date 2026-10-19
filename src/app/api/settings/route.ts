import { body, route } from "@/lib/server/http";
import { getSettings, updateSettings } from "@/lib/server/settings";
import { SettingsPatch } from "@/lib/shared/schemas";
import { setMeta } from "@/lib/server/settings";

export const GET = route(() => getSettings());
export const PATCH = route(async (req) => {
  const patch = await body(req, SettingsPatch);
  const before = getSettings();
  const after = updateSettings(patch);
  // A new day-start hour can change what "today" is; let rollover re-run.
  if (patch.day_start_hour !== undefined && patch.day_start_hour !== before.day_start_hour) setMeta("last_rollover", "");
  return after;
});
