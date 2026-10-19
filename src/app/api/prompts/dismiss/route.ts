import { z } from "zod";
import { body, route } from "@/lib/server/http";
import { setMeta } from "@/lib/server/settings";

const Input = z.object({
  kind: z.enum(["reflection", "review"]),
  key: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = route(async (req) => {
  const { kind, key } = await body(req, Input);
  setMeta(`${kind}_dismissed:${key}`, "1");
});
