// Resets the database and fills it with ~60 days of realistic demo history.
import "dotenv/config";
import { resetDatabase } from "./reset";
import { db } from "../src/lib/server/db";
import { ensureDay } from "../src/lib/server/day";
import { setMeta, today as getToday } from "../src/lib/server/settings";
import { addDays, dateRange, startOfDayUTC, weekStart, weekday } from "../src/lib/shared/dates";
import { isScheduledOn } from "../src/lib/shared/metrics";
import type { RecurrenceRule } from "../src/lib/shared/schemas";

resetDatabase();
const conn = db();

// Deterministic randomness so the demo looks the same every time.
let seed = 20261019;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const at = (date: string, hour: number, minute = 0) =>
  new Date(new Date(startOfDayUTC(date)).getTime() + (hour * 60 + minute) * 60_000).toISOString();

const today = getToday();
const yesterday = addDays(today, -1);
const START = addDays(today, -60);
const A = { School: 1, HazaraKids: 2, Clients: 3, Mehwar: 4, German: 5, Fitness: 6, Personal: 7 };

// ---------- Goals & milestones ----------
const insertGoal = conn.prepare(
  `INSERT INTO goals (area_id, title, description, type, target_value, current_value, unit, start_date, deadline, created_at)
   VALUES (@area_id, @title, @description, @type, @target_value, 0, @unit, @start_date, @deadline, @created_at)`,
);
const goal = (g: Record<string, unknown>) =>
  Number(insertGoal.run({ created_at: at(g.start_date as string, 9), ...g }).lastInsertRowid);

const G_EPISODES = goal({
  area_id: A.HazaraKids,
  title: "Publish 12 Hazara Kids episodes",
  description: "Season one: script, record and edit twelve short episodes.",
  type: "task_based",
  target_value: null,
  unit: "",
  start_date: addDays(today, -56),
  deadline: addDays(today, 42),
});
const G_GERMAN = goal({
  area_id: A.German,
  title: "Learn 1,500 German words",
  description: "Build vocabulary for the B1 exam.",
  type: "numeric",
  target_value: 1500,
  unit: "words",
  start_date: START,
  deadline: addDays(today, 75),
});
const G_RUN = goal({
  area_id: A.Fitness,
  title: "Run 120 km",
  description: "Consistent easy runs, three times a week.",
  type: "numeric",
  target_value: 120,
  unit: "km",
  start_date: addDays(today, -45),
  deadline: addDays(today, 30),
});

const insertMilestone = conn.prepare("INSERT INTO milestones (goal_id, title, due_date, done, sort_order) VALUES (?, ?, ?, ?, ?)");
[
  [G_EPISODES, "Episodes 1–3 published", addDays(today, -35), 1],
  [G_EPISODES, "Episodes 4–6 published", addDays(today, -7), 0],
  [G_EPISODES, "Episodes 7–9 published", addDays(today, 18), 0],
  [G_EPISODES, "Season finale out", addDays(today, 42), 0],
  [G_GERMAN, "First 500 words", addDays(today, -20), 1],
  [G_GERMAN, "1,000 words", addDays(today, 25), 0],
  [G_GERMAN, "B1 practice test", addDays(today, 70), 0],
  [G_RUN, "First 40 km", addDays(today, -15), 1],
  [G_RUN, "Run a 10K without stopping", addDays(today, 25), 0],
].forEach(([g, title, due, done], i) => insertMilestone.run(g, title, due, done, i));

// ---------- Tasks ----------
const insertTask = conn.prepare(
  `INSERT INTO tasks (title, notes, area_id, goal_id, priority, estimate_min, actual_min, due_date, scheduled_date, status,
     is_top3, carried_over_count, completed_at, completed_date, recurrence_id, sort_order, created_at)
   VALUES (@title, '', @area_id, @goal_id, @priority, @estimate_min, @actual_min, @due_date, @scheduled_date, @status,
     @is_top3, @carried, @completed_at, @completed_date, @recurrence_id, @sort_order, @created_at)`,
);
const insertCarry = conn.prepare("INSERT INTO carry_log (task_id, from_date, to_date) VALUES (?, ?, ?)");
const insertFocus = conn.prepare("INSERT INTO focus_sessions (task_id, started_at, ended_at, duration_min) VALUES (?, ?, ?, ?)");
const insertLog = conn.prepare("INSERT INTO progress_logs (goal_id, date, delta, note, created_at) VALUES (?, ?, ?, ?, ?)");

type NewTask = {
  title: string;
  area_id: number;
  goal_id?: number | null;
  priority?: number;
  estimate_min?: number | null;
  due_date?: string | null;
  scheduled_date: string | null;
  status?: string;
  is_top3?: number;
  carried?: number;
  completed_date?: string | null;
  recurrence_id?: number | null;
  actual_min?: number;
};
let sort = 0;
function addTask(t: NewTask): number {
  const completedAt = t.completed_date ? at(t.completed_date, between(9, 21), between(0, 59)) : null;
  const id = Number(
    insertTask.run({
      goal_id: null,
      priority: 2,
      estimate_min: null,
      due_date: null,
      status: "todo",
      is_top3: 0,
      carried: 0,
      completed_date: null,
      recurrence_id: null,
      actual_min: 0,
      ...t,
      completed_at: completedAt,
      sort_order: ++sort,
      created_at: at(t.scheduled_date ?? addDays(today, -between(1, 20)), 8),
    }).lastInsertRowid,
  );
  if (completedAt && t.actual_min && t.actual_min >= 15) {
    const end = new Date(completedAt);
    insertFocus.run(id, new Date(end.getTime() - t.actual_min * 60_000).toISOString(), completedAt, t.actual_min);
  }
  return id;
}

const TEMPLATES: [number, string[]][] = [
  [A.School, ["Read chapter {n} for Econ", "Problem set {n} — Statistics", "Revise lecture notes", "Prep group project slides", "Library: find sources for essay"]],
  [A.Clients, ["Send invoice to Noor Textiles", "Logo revisions for Chai Spot", "Call with Bilal about website", "Write homepage copy for Zara Studio", "Social posts for Noor Textiles"]],
  [A.Mehwar, ["Draft Mehwar newsletter", "Plan Mehwar meetup", "Reply to Mehwar volunteers", "Update Mehwar donor sheet"]],
  [A.German, ["Grammar: Dativ prepositions", "Write 10 sentences in Perfekt", "Listen to Easy German episode", "Practice speaking with tandem partner"]],
  [A.Personal, ["Groceries", "Pay electricity bill", "Call Ammi", "Clean desk", "Fix bike brakes", "Book dentist appointment"]],
];
const ESTIMATES = [15, 20, 30, 30, 45, 60, 60, 90];

// Hazara Kids episode pipeline, worked through in order over the history.
const episodeSteps: { title: string; estimate: number }[] = [];
for (let ep = 1; ep <= 12; ep++) {
  episodeSteps.push({ title: `Script ep ${ep}`, estimate: 90 }, { title: `Record ep ${ep}`, estimate: 60 }, { title: `Edit ep ${ep}`, estimate: 120 });
}
let episodeCursor = 0;

// Simulate each past day: plan tasks, complete most of them, carry the rest.
type Open = { title: string; area_id: number; goal_id: number | null; priority: number; estimate: number; carried: number; firstDay: string; carries: string[] };
let open: Open[] = [];

for (const day of dateRange(START, yesterday)) {
  const wd = weekday(day);
  const focus = wd === 6 || wd === 7 ? 0.62 : wd === 5 ? 0.72 : wd === 2 || wd === 3 ? 0.9 : 0.82;
  const fresh: Open[] = [];
  const n = wd >= 6 ? between(1, 2) : between(2, 4);
  for (let i = 0; i < n; i++) {
    const [area, titles] = pick(TEMPLATES);
    fresh.push({ title: pick(titles).replace("{n}", String(between(3, 12))), area_id: area, goal_id: null, priority: pick([1, 2, 2, 3]), estimate: pick(ESTIMATES), carried: 0, firstDay: day, carries: [] });
  }
  if (rand() < 0.35 && episodeCursor < 14) {
    const step = episodeSteps[episodeCursor++];
    fresh.push({ title: step.title, area_id: A.HazaraKids, goal_id: G_EPISODES, priority: 1, estimate: step.estimate, carried: 0, firstDay: day, carries: [] });
  }

  const planned = [...open, ...fresh];
  const top3 = [...planned].sort((a, b) => a.priority - b.priority).slice(0, 3);
  let top3Done = 0;
  const next: Open[] = [];

  for (const t of planned) {
    const isTop = top3.includes(t);
    const p = Math.min(0.97, focus + (isTop ? 0.08 : 0) - t.carried * 0.05);
    if (rand() < p) {
      if (isTop) top3Done++;
      const id = addTask({
        title: t.title,
        area_id: t.area_id,
        goal_id: t.goal_id,
        priority: t.priority,
        estimate_min: t.estimate,
        scheduled_date: day,
        status: "done",
        is_top3: isTop ? 1 : 0,
        carried: t.carried,
        completed_date: day,
        actual_min: Math.round(t.estimate * (0.75 + rand() * 0.85)),
      });
      t.carries.forEach((from, i) => insertCarry.run(id, from, t.carries[i + 1] ?? day));
    } else if (t.carried >= 2 && rand() < 0.3) {
      // Dropped after slipping too often.
      const id = addTask({ title: t.title, area_id: t.area_id, goal_id: t.goal_id, priority: t.priority, estimate_min: t.estimate, scheduled_date: day, status: "skipped", carried: t.carried });
      t.carries.forEach((from, i) => insertCarry.run(id, from, t.carries[i + 1] ?? day));
    } else {
      next.push({ ...t, carried: t.carried + 1, carries: [...t.carries, day] });
    }
  }
  open = next;

  conn
    .prepare("INSERT INTO day_logs (date, top3_done, top3_count, reflection, energy, mood) VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      day,
      top3.length && top3Done === top3.length ? 1 : 0,
      top3.length,
      rand() < 0.4 ? pick(["Good focus in the morning.", "Too many meetings.", "Slept badly, still got the big thing done.", "Felt scattered.", "Great run, clear head.", "Client work ate the afternoon.", "Steady day."]) : "",
      rand() < 0.8 ? Math.max(1, Math.min(5, Math.round(3.3 + (focus - 0.8) * 6 + (rand() - 0.5) * 2))) : null,
      rand() < 0.8 ? Math.max(1, Math.min(5, Math.round(3.5 + (rand() - 0.5) * 2.4))) : null,
    );
}

// Tasks still open after yesterday stay on yesterday; the real rollover below carries them into today.
for (const t of open) {
  const id = addTask({ title: t.title, area_id: t.area_id, goal_id: t.goal_id, priority: t.priority, estimate_min: t.estimate, scheduled_date: yesterday, carried: t.carried });
  t.carries.forEach((from, i) => insertCarry.run(id, from, t.carries[i + 1] ?? yesterday));
}

// Two tasks that keep slipping, so the ↻ badge and the "3+ carries" prompt have something to show.
for (const [title, area, carries] of [
  ["Update Mehwar donor sheet", A.Mehwar, 3],
  ["Logo revisions for Chai Spot", A.Clients, 1],
] as const) {
  const first = addDays(yesterday, -carries);
  const id = addTask({ title, area_id: area, priority: 2, estimate_min: 45, scheduled_date: yesterday, carried: carries });
  for (let i = 0; i < carries; i++) insertCarry.run(id, addDays(first, i), addDays(first, i + 1));
}

// Remaining episode steps: the next few are scheduled, the rest wait in the backlog with due dates.
episodeSteps.slice(episodeCursor).forEach((step, i) => {
  addTask({
    title: step.title,
    area_id: A.HazaraKids,
    goal_id: G_EPISODES,
    priority: 1,
    estimate_min: step.estimate,
    scheduled_date: i === 0 ? today : i === 1 ? addDays(today, 1) : i === 2 ? addDays(today, 3) : null,
    due_date: addDays(today, Math.min(42, 3 + i * 2)),
  });
});

// ---------- Habits ----------
const insertHabit = conn.prepare("INSERT INTO recurrences (title, area_id, goal_id, rule, estimate_min, start_date) VALUES (?, ?, ?, ?, ?, ?)");
const habits: { title: string; area: number; goal: number | null; rule: RecurrenceRule; est: number; p: number; start: string }[] = [
  { title: "Anki review", area: A.German, goal: G_GERMAN, rule: { type: "daily" }, est: 15, p: 0.86, start: START },
  { title: "Workout", area: A.Fitness, goal: null, rule: { type: "weekdays", days: [1, 3, 5] }, est: 45, p: 0.8, start: START },
  { title: "Run", area: A.Fitness, goal: G_RUN, rule: { type: "weekly", count: 3 }, est: 40, p: 0.36, start: addDays(today, -45) },
  { title: "Read 20 pages", area: A.Personal, goal: null, rule: { type: "daily" }, est: 25, p: 0.7, start: START },
  { title: "Plan tomorrow", area: A.Personal, goal: null, rule: { type: "daily" }, est: 5, p: 0.78, start: START },
  { title: "Client inbox zero", area: A.Clients, goal: null, rule: { type: "weekdays", days: [1, 2, 3, 4, 5] }, est: 20, p: 0.82, start: START },
  { title: "Mehwar journal", area: A.Mehwar, goal: null, rule: { type: "interval", every: 2 }, est: 15, p: 0.72, start: START },
];

for (const h of habits) {
  const hid = Number(insertHabit.run(h.title, h.area, h.goal, JSON.stringify(h.rule), h.est, h.start).lastInsertRowid);
  const weekCounts = new Map<string, number>();
  for (const day of dateRange(h.start, yesterday)) {
    if (!isScheduledOn(h.rule, day, h.start)) continue;
    // A rough patch two weeks ago makes the streaks and heatmap more realistic.
    const slump = day >= addDays(today, -18) && day <= addDays(today, -15) ? 0.4 : 0;
    const done = rand() < h.p - slump;
    if (h.rule.type === "weekly") {
      const ws = weekStart(day);
      if (!done || (weekCounts.get(ws) ?? 0) >= h.rule.count) continue;
      weekCounts.set(ws, (weekCounts.get(ws) ?? 0) + 1);
    }
    addTask({
      title: h.title,
      area_id: h.area,
      estimate_min: h.est,
      scheduled_date: day,
      status: done ? "done" : "todo",
      completed_date: done ? day : null,
      recurrence_id: hid,
      actual_min: done ? h.est : 0,
    });
    if (done && h.goal === G_GERMAN) insertLog.run(G_GERMAN, day, between(6, 20), "", at(day, 22));
    if (done && h.goal === G_RUN) insertLog.run(G_RUN, day, between(30, 70) / 10, pick(["Easy pace", "Park loop", "Felt strong", "Windy", ""]), at(day, 7));
  }
}
conn.prepare("UPDATE goals SET current_value = (SELECT COALESCE(SUM(delta), 0) FROM progress_logs WHERE goal_id = goals.id) WHERE type = 'numeric'").run();

// ---------- Inbox & upcoming ----------
const inbox: [string, number, number, number | null][] = [
  ["Research mic upgrade for recordings", A.HazaraKids, 3, 30],
  ["Renew passport", A.Personal, 2, 60],
  ["Portfolio case study for Chai Spot", A.Clients, 2, 120],
  ["Ask professor about thesis topic", A.School, 1, 15],
  ["Mehwar annual report outline", A.Mehwar, 2, 60],
  ["Buy new running shoes", A.Fitness, 3, null],
];
for (const [title, area, priority, est] of inbox) addTask({ title, area_id: area, priority, estimate_min: est, scheduled_date: null });

const upcoming: [string, number, number, number, number][] = [
  ["Statistics midterm revision", A.School, 1, 90, 2],
  ["Client call: Zara Studio kickoff", A.Clients, 1, 45, 1],
  ["Mehwar meetup", A.Mehwar, 2, 120, 5],
  ["German tandem session", A.German, 2, 60, 4],
  ["Submit Econ essay", A.School, 1, 60, 6],
];
for (const [title, area, priority, est, offset] of upcoming)
  addTask({ title, area_id: area, priority, estimate_min: est, scheduled_date: addDays(today, offset), due_date: addDays(today, offset) });

// ---------- Weekly reviews (all but last week, so the Monday prompt shows) ----------
const insertReview = conn.prepare(
  "INSERT INTO weekly_reviews (week_start, wins, slipped, notes, next_week_focus, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
);
for (let w = weekStart(addDays(START, 7)); w < addDays(weekStart(today), -7); w = addDays(w, 7)) {
  insertReview.run(
    w,
    pick(["Shipped an episode and kept Anki going.", "Four workouts!", "Client paid on time, finished the problem set early."]),
    pick(["Mehwar admin kept slipping.", "Reading habit fell off midweek.", "Too much context switching on Thursday."]),
    "",
    pick(["Finish the next episode edit.", "Protect mornings for deep work.", "Get ahead on Statistics."]),
    at(addDays(w, 6), 20),
  );
}

// Let the real rollover carry yesterday's leftovers into today and create today's habit instances.
setMeta("last_rollover", yesterday);
ensureDay();

const count = (sql: string) => (conn.prepare(sql).get() as { n: number }).n;
console.log(
  `Seeded: ${count("SELECT COUNT(*) n FROM tasks")} tasks, ${count("SELECT COUNT(*) n FROM recurrences")} habits, ` +
    `${count("SELECT COUNT(*) n FROM goals")} goals, ${count("SELECT COUNT(*) n FROM focus_sessions")} focus sessions, ` +
    `${count("SELECT COUNT(*) n FROM tasks WHERE scheduled_date = '" + today + "'")} tasks today.`,
);
