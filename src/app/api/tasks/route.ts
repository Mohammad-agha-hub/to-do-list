import { body, HttpError, route } from "@/lib/server/http";
import { createTask, listTasks } from "@/lib/server/tasks";
import { ensureDay } from "@/lib/server/day";
import { TaskInput } from "@/lib/shared/schemas";
import { addDays } from "@/lib/shared/dates";

// ?view=inbox | upcoming | date&date=YYYY-MM-DD
export const GET = route(async (req) => {
  const today = await ensureDay();
  const params = new URL(req.url).searchParams;
  switch (params.get("view") ?? "inbox") {
    case "inbox":
      return listTasks("scheduled_date IS NULL AND status = 'todo'", {}, "priority, due_date IS NULL, due_date, sort_order, id");
    case "upcoming":
      return listTasks(
        "scheduled_date BETWEEN @from AND @to AND status = 'todo'",
        { from: addDays(today, 1), to: addDays(today, 7) },
        "scheduled_date, priority, sort_order, id",
      );
    case "date": {
      const date = params.get("date") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Bad date");
      return listTasks("scheduled_date = @date", { date });
    }
    default:
      throw new HttpError(400, "Unknown view");
  }
});

export const POST = route(async (req) => createTask(await body(req, TaskInput)));
