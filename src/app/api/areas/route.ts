import { body, route } from "@/lib/server/http";
import { createArea, listAreas } from "@/lib/server/areas";
import { AreaInput } from "@/lib/shared/schemas";

export const GET = route(() => listAreas());
export const POST = route(async (req) => createArea(await body(req, AreaInput)));
