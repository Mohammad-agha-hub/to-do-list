import {
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  Flame,
  Inbox,
  Moon,
  Plus,
  RotateCw,
  Smartphone,
  Star,
  SunMedium,
  Tag,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

type Topic = { icon: LucideIcon; title: string; what: string; how: React.ReactNode[]; example?: string };

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-fg">{children}</code>
);

const TOPICS: Topic[] = [
  {
    icon: SunMedium,
    title: "Today",
    what: "Your home screen: everything planned for today, with a progress ring.",
    how: [
      <>Tap the circle next to a task (or swipe it right) to finish it.</>,
      <>Swipe left to push it to tomorrow.</>,
      <>Tap a task&apos;s name to edit it. Long-press it for more: focus timer, Top 3, reschedule, skip, delete.</>,
      <>Drag the ⋮⋮ handle to reorder.</>,
      <>The bar under the ring compares planned time with the hours you have; it turns orange if you planned too much.</>,
    ],
  },
  {
    icon: Plus,
    title: "Adding tasks (quick add)",
    what: "One line that understands shortcuts, so adding a task takes seconds.",
    how: [
      <>Tap the blue + button (or press N on a computer) and type.</>,
      <><Code>#area</Code> sets the area, <Code>!1</Code> <Code>!2</Code> <Code>!3</Code> set priority (high/medium/low).</>,
      <><Code>today</Code>, <Code>tomorrow</Code>, <Code>friday</Code> or <Code>25-10</Code> set the day.</>,
      <><Code>~30m</Code> or <Code>~1h</Code> is how long you think it takes. <Code>@goal</Code> links it to a goal.</>,
      <>Everything else becomes the task name. Labels under the box show what it understood.</>,
    ],
    example: "edit ep 4 #hazarakids !1 tomorrow ~2h @episodes",
  },
  {
    icon: Star,
    title: "Top 3",
    what: "The three things that would make today a good day, even if nothing else gets done.",
    how: [
      <>Each morning tap “Pick today&apos;s Top 3” and choose three tasks.</>,
      <>They stay pinned at the top. Finish all three and the day counts as a win (with a little confetti).</>,
    ],
  },
  {
    icon: RotateCw,
    title: "Unfinished tasks roll over",
    what: "Anything you don't finish moves to the next day by itself, so nothing gets lost.",
    how: [
      <>A ↻ badge shows how many times a task has slipped.</>,
      <>After 3 slips you get a gentle question: do it now, break it into smaller steps, reschedule it, or drop it.</>,
    ],
  },
  {
    icon: Inbox,
    title: "Inbox",
    what: "A place for tasks without a day yet: ideas, “someday” things, stuff you'll plan later.",
    how: [
      <>Add from the Inbox screen (or type a task with no day while you&apos;re there).</>,
      <>When you&apos;re ready, swipe a task left to do it today, or schedule it during the weekly review.</>,
    ],
    example: "renew passport #personal",
  },
  {
    icon: CalendarRange,
    title: "Upcoming",
    what: "The next 7 days at a glance, so you can see busy days coming.",
    how: [<>Use “+ Add to …” under any day to plan ahead. Habits appear on their day automatically.</>],
  },
  {
    icon: Flame,
    title: "Habits",
    what: "Things you repeat: Anki every day, gym Mon/Wed/Fri, run 3× a week.",
    how: [
      <>Habits tab → + New. Choose daily, specific days, every few days, or a number of times per week.</>,
      <>On the right days the habit appears on Today by itself. Tick it there or on the Habits tab.</>,
      <>The flame is your streak. Missing a day you were supposed to do it breaks the streak; days off don&apos;t.</>,
      <>The row of dots shows your last 30 days.</>,
    ],
  },
  {
    icon: Target,
    title: "Goals",
    what: "Bigger things you're working towards. Small daily tasks add up to them.",
    how: [
      <>Goals tab → + New. Pick how it&apos;s measured: by linked tasks (e.g. 12 episodes) or by a number (e.g. 120 km).</>,
      <>Link tasks with <Code>@goal</Code> in quick add. Finishing them moves the goal&apos;s progress bar.</>,
      <>For number goals, open the goal and log progress (e.g. +5 km).</>,
      <>The pace line tells you if you&apos;re on track: “Need 3/week, doing 1.2/week, behind.”</>,
      <>Inside a goal: milestones checklist, its tasks, and a chart of progress vs the pace you need.</>,
    ],
  },
  {
    icon: Timer,
    title: "Focus timer",
    what: "A Pomodoro timer: 25 minutes of focus, 5 minutes break.",
    how: [
      <>Long-press a task → Start focus. Or More → Free focus.</>,
      <>It keeps the right time even if your screen locks. Time spent is added to the task.</>,
      <>Lengths can be changed in Settings.</>,
    ],
  },
  {
    icon: Moon,
    title: "Evening reflection",
    what: "A 10-second check-in: energy, mood, and one line about the day.",
    how: [<>It appears on Today in the evening, or anytime from More → Reflect on today.</>],
  },
  {
    icon: ClipboardCheck,
    title: "Weekly review",
    what: "Five minutes on Sunday evening to look back and plan the next week.",
    how: [
      <>A banner appears on Today on Sunday evening (or Monday if you missed it).</>,
      <>See what you finished, what slipped, which goals are behind; write your wins and next week&apos;s focus.</>,
      <>Then tap day buttons next to Inbox tasks to plan the week. Your focus line shows on Today all week.</>,
    ],
  },
  {
    icon: BarChart3,
    title: "Stats",
    what: "Your patterns: a year of activity, best weekday, Top 3 win rate, time per area, how good your estimates are.",
    how: [<>Just look. It fills up as you use the app.</>],
  },
  {
    icon: Tag,
    title: "Areas",
    what: "The parts of your life tasks belong to: School, Clients, German…",
    how: [<>Add, rename, recolor or archive them in More → Settings → Areas. Use them in quick add with <Code>#name</Code>.</>],
  },
  {
    icon: Smartphone,
    title: "On your phone",
    what: "Momentum works like an app and keeps working without internet.",
    how: [
      <>In Chrome: menu → Install app. You stay signed in on that device until you sign out.</>,
      <>Offline you can still open it and tick tasks; changes sync when you&apos;re back online.</>,
    ],
  },
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader title="How to use Momentum" subtitle="Small daily tasks that add up to big goals." />
      <div className="card mb-5 p-4 text-sm leading-relaxed">
        <p className="font-semibold">A good daily rhythm</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Morning: open Today, pick your Top 3.</li>
          <li>During the day: tick things off, use the focus timer for big tasks.</li>
          <li>Anything new: + button. No day yet? It goes to the Inbox.</li>
          <li>Evening: quick reflection. Sunday: weekly review.</li>
        </ol>
      </div>
      <div className="space-y-2.5">
        {TOPICS.map((t) => (
          <details key={t.title} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <t.icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.title}</span>
                <span className="block text-sm text-muted">{t.what}</span>
              </span>
              <span className="text-muted transition group-open:rotate-90">›</span>
            </summary>
            <div className="border-t border-line px-4 py-3 text-sm leading-relaxed">
              <ul className="list-disc space-y-1.5 pl-5">
                {t.how.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
              {t.example && (
                <p className="mt-3 text-muted">
                  Example: <Code>{t.example}</Code>
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Ready? <Link href="/" className="font-medium text-primary">Go to Today →</Link>
      </p>
    </div>
  );
}
