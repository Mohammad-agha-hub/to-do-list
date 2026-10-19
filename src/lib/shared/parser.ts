import { addDays, diffDays, weekday } from "./dates";

export type ParseContext = {
  areas: { id: number; name: string; archived?: boolean }[];
  goals: { id: number; title: string; status?: string }[];
  today: string;
};

export type ChipKind = "area" | "priority" | "date" | "estimate" | "goal";
export type ParsedChip = { kind: ChipKind; label: string; token: string };

export type ParsedTask = {
  title: string;
  area_id?: number;
  priority?: 1 | 2 | 3;
  scheduled_date?: string;
  estimate_min?: number;
  goal_id?: number;
  chips: ParsedChip[];
};

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

/** 0 = no match; higher is better. */
export function fuzzyScore(query: string, target: string): number {
  const q = norm(query);
  const t = norm(target);
  if (!q || !t) return 0;
  if (t === q) return 120;
  if (t.startsWith(q)) return 100;
  const words = target.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 90;
  const idx = t.indexOf(q);
  if (idx >= 0) return 80 - Math.min(idx, 20) * 0.5;
  // Subsequence match, e.g. "hzk" → "hazarakids"
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  if (i === q.length && q.length >= 3) return 30 + 20 * (q.length / t.length);
  return 0;
}

function bestMatch<T>(query: string, items: T[], label: (t: T) => string, boost: (t: T) => number = () => 0): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const item of items) {
    const s = fuzzyScore(query, label(item));
    if (s > 0 && s + boost(item) > bestScore) {
      best = item;
      bestScore = s + boost(item);
    }
  }
  return best;
}

const PRIORITIES: Record<string, 1 | 2 | 3> = {
  "1": 1, high: 1, hi: 1, h: 1,
  "2": 2, med: 2, medium: 2, m: 2,
  "3": 3, low: 3, lo: 3, l: 3,
};
export const PRIORITY_LABEL = { 1: "High", 2: "Medium", 3: "Low" } as const;

const WEEKDAYS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
  mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5,
};
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDate(word: string, today: string): { date: string; label: string } | null {
  if (word === "today" || word === "tod") return { date: today, label: "Today" };
  if (word === "tomorrow" || word === "tmr" || word === "tmrw") return { date: addDays(today, 1), label: "Tomorrow" };
  if (word in WEEKDAYS) {
    const target = WEEKDAYS[word];
    // The next occurrence; if it's today, that's today.
    const ahead = (target - weekday(today) + 7) % 7;
    const date = addDays(today, ahead);
    return { date, label: ahead === 0 ? "Today" : ahead === 1 ? "Tomorrow" : WEEKDAY_NAMES[target - 1] };
  }
  const m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(word);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const year = Number(today.slice(0, 4));
    for (const y of [year, year + 1]) {
      const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      // Reject impossible dates like 31-02.
      if (addDays(iso, 0) !== iso) return null;
      if (diffDays(iso, today) >= 0) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return { date: iso, label: `${d} ${months[mo - 1]}${y !== year ? ` ${y}` : ""}` };
      }
    }
  }
  return null;
}

function parseEstimate(raw: string): number | null {
  const s = raw.toLowerCase();
  let m = /^(\d+)h(\d+)m?$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+(?:\.\d+)?)(m|min|mins|h|hr|hrs)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const minutes = m[2]?.startsWith("h") ? n * 60 : n;
  return minutes > 0 && minutes <= 24 * 60 ? Math.round(minutes) : null;
}

export function formatEstimate(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/**
 * Parses quick-add text like `edit ep 4 #hazarakids !1 tomorrow ~2h @episodes`.
 * Recognised tokens become fields and chips; everything else is the title.
 */
export function parseQuickAdd(input: string, ctx: ParseContext): ParsedTask {
  const out: ParsedTask = { title: "", chips: [] };
  const titleWords: string[] = [];
  const setChip = (chip: ParsedChip) => {
    out.chips = out.chips.filter((c) => c.kind !== chip.kind);
    out.chips.push(chip);
  };

  for (const token of input.split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase();

    if (lower.length > 1 && lower[0] === "#") {
      const area = bestMatch(token.slice(1), ctx.areas, (a) => a.name, (a) => (a.archived ? -50 : 0));
      if (area) {
        out.area_id = area.id;
        setChip({ kind: "area", label: area.name, token });
        continue;
      }
    }

    if (lower.length > 1 && lower[0] === "!" && lower.slice(1) in PRIORITIES) {
      out.priority = PRIORITIES[lower.slice(1)];
      setChip({ kind: "priority", label: PRIORITY_LABEL[out.priority], token });
      continue;
    }

    if (lower.length > 1 && lower[0] === "~") {
      const est = parseEstimate(lower.slice(1));
      if (est) {
        out.estimate_min = est;
        setChip({ kind: "estimate", label: formatEstimate(est), token });
        continue;
      }
    }

    if (lower.length > 1 && lower[0] === "@") {
      const goal = bestMatch(token.slice(1), ctx.goals, (g) => g.title, (g) => (g.status && g.status !== "active" ? -50 : 0));
      if (goal) {
        out.goal_id = goal.id;
        setChip({ kind: "goal", label: goal.title, token });
        continue;
      }
    }

    const date = parseDate(lower, ctx.today);
    if (date) {
      out.scheduled_date = date.date;
      setChip({ kind: "date", label: date.label, token });
      continue;
    }

    titleWords.push(token);
  }

  out.title = titleWords.join(" ");
  return out;
}
