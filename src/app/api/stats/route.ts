import { route } from "@/lib/server/http";
import { statsData } from "@/lib/server/stats";

export const GET = route(() => statsData());
