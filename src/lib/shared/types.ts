import type { RecurrenceRule, Settings } from "./schemas";

export type Area = {
  id: number;
  name: string;
  color: string;
  icon: string;
  archived: boolean;
  sort_order: number;
};

export type GoalType = "task_based" | "numeric";
export type GoalStatus = "active" | "completed" | "paused" | "abandoned";
export type PaceStatus = "on_track" | "at_risk" | "behind" | "done" | "none";

export type Pace = {
  status: PaceStatus;
  requiredPerWeek: number | null;
  actualPerWeek: number;
  daysLeft: number | null;
  label: string;
};

export type Goal = {
  id: number;
  area_id: number | null;
  title: string;
  description: string;
  type: GoalType;
  target_value: number | null;
  current_value: number;
  unit: string;
  start_date: string;
  deadline: string | null;
  status: GoalStatus;
  created_at: string;
};

export type GoalSummary = Goal & {
  progress: number; // 0..1
  done: number;
  total: number;
  pace: Pace;
};

export type Milestone = {
  id: number;
  goal_id: number;
  title: string;
  due_date: string | null;
  done: boolean;
  sort_order: number;
};

export type TaskStatus = "todo" | "done" | "skipped";

export type Task = {
  id: number;
  title: string;
  notes: string;
  area_id: number | null;
  goal_id: number | null;
  milestone_id: number | null;
  priority: 1 | 2 | 3;
  estimate_min: number | null;
  actual_min: number;
  due_date: string | null;
  scheduled_date: string | null;
  status: TaskStatus;
  is_top3: boolean;
  carried_over_count: number;
  completed_at: string | null;
  completed_date: string | null;
  recurrence_id: number | null;
  sort_order: number;
  created_at: string;
};

export type Habit = {
  id: number;
  title: string;
  area_id: number | null;
  goal_id: number | null;
  rule: RecurrenceRule;
  estimate_min: number | null;
  active: boolean;
  start_date: string;
};

export type DotStatus = "done" | "missed" | "off" | "pending" | "before";

export type HabitSummary = Habit & {
  current: number;
  best: number;
  unit: "days" | "weeks";
  strip: { date: string; status: DotStatus }[];
  todayTaskId: number | null;
  todayDone: boolean;
  weekDone: number;
};

export type ProgressLog = { id: number; goal_id: number; date: string; delta: number; note: string };

export type DayLog = {
  date: string;
  top3_done: boolean;
  top3_count: number;
  reflection: string;
  energy: number | null;
  mood: number | null;
};

export type WeeklyReview = {
  week_start: string;
  wins: string;
  slipped: string;
  notes: string;
  next_week_focus: string;
  completed_at: string | null;
};

export type Bootstrap = {
  today: string;
  areas: Area[];
  goals: Goal[];
  settings: Settings;
};

export type TodayData = {
  today: string;
  tasks: Task[]; // open tasks scheduled today
  done: Task[]; // completed today
  plannedMin: number;
  availableMin: number;
  dayLog: DayLog | null;
  reviewDue: string | null; // week_start of a pending review
  reflectionDue: boolean;
};

export type GoalDetail = GoalSummary & {
  milestones: Milestone[];
  tasks: Task[];
  logs: ProgressLog[];
  chart: { date: string; value: number }[];
};

export type StatsData = {
  today: string;
  heatmap: { date: string; done: number; planned: number }[];
  weekly: { week: string; done: number; planned: number }[];
  areaTime: { week: AreaMinutes[]; month: AreaMinutes[] };
  top3: { last30: { wins: number; days: number }; all: { wins: number; days: number } };
  weekdays: { weekday: number; pct: number; done: number }[];
  estimates: { ratio: number | null; samples: number; byArea: { area_id: number | null; ratio: number; samples: number }[] };
  streaks: { activeDays: number; top3Wins: number; habits: { id: number; title: string; current: number; best: number; unit: string }[] };
  moods: { date: string; energy: number | null; mood: number | null }[];
  totals: { doneAllTime: number; focusMinAllTime: number };
};

export type AreaMinutes = { area_id: number | null; minutes: number };

export type ReviewData = {
  weekStart: string;
  weekEnd: string;
  review: WeeklyReview | null;
  completedByArea: { area_id: number | null; count: number }[];
  completedTotal: number;
  slipped: { task_id: number; title: string; area_id: number | null; carries: number; status: TaskStatus }[];
  goalsBehind: GoalSummary[];
  backlog: Task[];
  nextWeek: Task[];
};
