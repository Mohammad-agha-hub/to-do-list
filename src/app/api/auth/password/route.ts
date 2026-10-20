import { z } from "zod";
import { body, HttpError, route } from "@/lib/server/http";
import { MIN_PASSWORD, changePassword, checkPassword } from "@/lib/server/auth";

const Body = z.object({ current: z.string().min(1).max(200), password: z.string().min(MIN_PASSWORD).max(200) });

export const POST = route(async (req) => {
  const { current, password } = await body(req, Body);
  if (!(await checkPassword(current))) throw new HttpError(400, "Current password is wrong");
  await changePassword(password);
});
