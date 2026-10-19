import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected #rrggbb");
const id = z.number().int().positive();

/**
 * Like `.partial()`, but without defaults. In Zod 4 `.partial()` still applies
 * `.default()` values, which would make a PATCH overwrite fields it didn't mention.
 */
function patchOf<S extends z.ZodRawShape>(schema: z.ZodObject<S>) {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const inner = field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : (field as z.ZodType);
    shape[key] = inner.optional();
  }
  return z.object(shape) as unknown as z.ZodType<Partial<z.output<z.ZodObject<S>>>>;
}

export const RecurrenceRule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekdays"), days: z.array(z.number().int().min(1).max(7)).min(1).max(7) }),
  z.object({ type: z.literal("interval"), every: z.number().int().min(2).max(90) }),
  z.object({ type: z.literal("weekly"), count: z.number().int().min(1).max(7) }),
]);
export type RecurrenceRule = z.infer<typeof RecurrenceRule>;

export const AreaInput = z.object({
  name: z.string().trim().min(1).max(40),
  color,
  icon: z.string().max(40).default("circle"),
  archived: z.boolean().default(false),
});
export const AreaPatch = patchOf(AreaInput);

export const GoalStatus = z.enum(["active", "completed", "paused", "abandoned"]);
export const GoalInput = z.object({
  area_id: id.nullable().default(null),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(""),
  type: z.enum(["task_based", "numeric"]),
  target_value: z.number().positive().nullable().default(null),
  current_value: z.number().default(0),
  unit: z.string().max(30).default(""),
  start_date: isoDate,
  deadline: isoDate.nullable().default(null),
  status: GoalStatus.default("active"),
});
export const GoalPatch = patchOf(GoalInput);

export const MilestoneInput = z.object({
  title: z.string().trim().min(1).max(120),
  due_date: isoDate.nullable().default(null),
  done: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});
export const MilestonePatch = patchOf(MilestoneInput);

export const TaskStatus = z.enum(["todo", "done", "skipped"]);
export const TaskInput = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(5000).default(""),
  area_id: id.nullable().default(null),
  goal_id: id.nullable().default(null),
  milestone_id: id.nullable().default(null),
  priority: z.number().int().min(1).max(3).default(2),
  estimate_min: z.number().int().min(0).max(24 * 60).nullable().default(null),
  due_date: isoDate.nullable().default(null),
  scheduled_date: isoDate.nullable().default(null),
  is_top3: z.boolean().default(false),
});
export const TaskPatch = patchOf(
  TaskInput.extend({
    status: TaskStatus,
    actual_min: z.number().int().min(0).max(100_000),
  }),
);
export const ReorderInput = z.object({ ids: z.array(id).min(1).max(500) });

export const HabitInput = z.object({
  title: z.string().trim().min(1).max(120),
  area_id: id.nullable().default(null),
  goal_id: id.nullable().default(null),
  rule: RecurrenceRule,
  estimate_min: z.number().int().min(0).max(24 * 60).nullable().default(null),
  active: z.boolean().default(true),
});
export const HabitPatch = patchOf(HabitInput);

export const ProgressLogInput = z.object({
  date: isoDate.optional(),
  delta: z.number().refine((n) => n !== 0, "Delta can't be zero"),
  note: z.string().max(500).default(""),
});

export const FocusInput = z.object({
  task_id: id.nullable(),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime(),
  duration_min: z.number().min(0).max(600),
});

export const DayLogInput = z.object({
  reflection: z.string().max(500).optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
});

export const WeeklyReviewInput = z.object({
  wins: z.string().max(5000).default(""),
  slipped: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
  next_week_focus: z.string().max(5000).default(""),
});

export const SettingsSchema = z.object({
  available_hours: z.number().min(0.5).max(18),
  pomodoro_focus: z.number().int().min(1).max(120),
  pomodoro_break: z.number().int().min(1).max(60),
  pomodoro_long_break: z.number().int().min(1).max(60),
  pomodoro_cycles: z.number().int().min(1).max(12),
  day_start_hour: z.number().int().min(0).max(6),
  reflection_hour: z.number().int().min(12).max(23),
  theme: z.enum(["light", "dark", "system"]),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const SettingsPatch = SettingsSchema.partial();

export const DEFAULT_SETTINGS: Settings = {
  available_hours: 6,
  pomodoro_focus: 25,
  pomodoro_break: 5,
  pomodoro_long_break: 15,
  pomodoro_cycles: 4,
  day_start_hour: 4,
  reflection_hour: 20,
  theme: "system",
};
