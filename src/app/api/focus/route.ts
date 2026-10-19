import { body, route } from "@/lib/server/http";
import { logFocusSession } from "@/lib/server/focus";
import { FocusInput } from "@/lib/shared/schemas";

export const POST = route(async (req) => logFocusSession(await body(req, FocusInput)));
