import type { z } from "zod";
import { db } from "./db";
import { HttpError } from "./http";
import type { FocusInput } from "@/lib/shared/schemas";

/** Records a finished focus block and adds its minutes to the task's actual time. */
export async function logFocusSession(input: z.infer<typeof FocusInput>) {
  if (input.ended_at < input.started_at) throw new HttpError(400, "Session ends before it starts");
  const minutes = Math.round(input.duration_min * 10) / 10;
  const [inserted] = await (await db()).batch([
    {
      sql: "INSERT INTO focus_sessions (task_id, started_at, ended_at, duration_min) VALUES (?, ?, ?, ?)",
      params: [input.task_id, input.started_at, input.ended_at, minutes],
    },
    ...(input.task_id ? [{ sql: "UPDATE tasks SET actual_min = actual_min + ? WHERE id = ?", params: [Math.round(minutes), input.task_id] }] : []),
  ]);
  return { id: inserted.lastId, minutes };
}
