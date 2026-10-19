import { route } from "@/lib/server/http";
import { todayData } from "@/lib/server/day";

export const GET = route(() => todayData());
