# Momentum

A personal daily-tasks + goals app. Small daily tasks roll up into long-term goals, so finishing
today's list visibly moves the big things.

Built with Next.js 16 (App Router + route handlers), SQLite (better-sqlite3), zod, Tailwind CSS 4,
Recharts and TanStack Query. Installable as a PWA with offline viewing and ticking.

## Quick start

```bash
npm install
cp .env.example .env        # set APP_PASSWORD and SESSION_SECRET (openssl rand -hex 32)
npm run seed                # optional: 60 days of demo data
npm run dev                 # http://localhost:3000
```

Production (one server for API + UI):

```bash
npm run build && npm start  # PORT=3000 by default
```

| Script            | What it does                                                     |
| ----------------- | ---------------------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload (service worker disabled)             |
| `npm run build`   | Production build                                                 |
| `npm start`       | Serve the production build                                       |
| `npm run seed`    | **Wipes** the DB and loads demo data (3 goals, 7 habits, 60 days)|
| `npm run reset`   | **Wipes** the DB, keeps only the default areas                   |
| `npm test`        | Unit + integration tests (Vitest)                                |
| `npm run typecheck` | TypeScript check                                               |

Seed and reset work in place, so a running server picks up the new data without a restart.

## Configuration

`.env`:

- `APP_PASSWORD`: the single user's password. In development it defaults to `momentum` if unset.
- `SESSION_SECRET`: signs the session cookie. Required in production.
- `DATABASE_PATH`: SQLite file, default `./data/momentum.db`.
- `INSECURE_COOKIE=1`: lets the cookie work over plain http in production (LAN testing only).

Dates use **Asia/Karachi**, weeks start on **Monday**, and the day-start hour (default 4am, set in
Settings) means 1am still counts as "today".

## Using it

- **Quick add** (`+` button, or `N` on desktop):
  `edit ep 4 #hazarakids !1 tomorrow ~2h @episodes`
  - `#area`, `!1/!2/!3` or `!high/!med/!low`, `today`, `tomorrow`, weekday names, `dd-mm`,
    `~30m`/`~1h`/`~1h30m`, `@goal` (fuzzy). Everything else is the title.
- **Tasks:** tap the circle (or swipe right) to complete, swipe left to move to tomorrow, long-press
  (right-click on desktop) for focus / Top 3 / reschedule / skip / delete, tap the title to edit,
  drag the handle to reorder.
- **Top 3:** pick three each day; finishing all three makes the day a win.
- **Rollover:** on the first request of a new day, unfinished tasks move to today with a ↻ count.
  At 3+ carries you get a nudge to do it, break it down, reschedule or drop it.
- **Habits:** daily, specific weekdays, every N days, or N× per week. Missing a scheduled day breaks
  the streak; unscheduled days don't.
- **Goals:** task-based (done ÷ linked tasks) or numeric (log entries). Pace compares the rate
  needed to hit the deadline with your actual rate: on track / at risk (≥75%) / behind.
- **Focus timer:** Pomodoro from any task. It runs on timestamps, so it's correct after the screen
  locks; finished blocks are logged and added to the task's time spent.
- **Weekly review:** offered Sunday evening, or on Monday if skipped.

## Install on Android

The PWA needs HTTPS (or `localhost`). Deploy behind HTTPS, open it in Chrome, then
menu → *Install app*. Offline: previously visited screens load from cache, and completing or
editing tasks is queued and synced when the connection returns.

## Project layout

```
src/
  app/(app)/…        pages (client components that only talk to /api)
  app/api/…          REST route handlers (zod-validated)
  app/focus          full-screen focus timer
  lib/server/        SQLite schema, rollover, habits, goals, stats, review, backup
  lib/shared/        dates (Karachi tz), quick-add parser, metrics (pace, streaks), schemas, types
  lib/client/        fetch + offline queue, React Query hooks, focus timer state, theme
  components/        UI
public/sw.js         service worker
scripts/             seed + reset
```

## Wrapping with Capacitor later

All pages are static client components that fetch from `/api`, so the UI can be exported and
wrapped. Point it at your server with `NEXT_PUBLIC_API_URL=https://your-host` (requests send
credentials; the server will need CORS and a `SameSite=None; Secure` cookie for a cross-origin shell).

## Backups

Settings → Backup exports everything as JSON; importing replaces all data in one transaction.
The database is a single SQLite file, so copying `data/momentum.db` (with the server stopped) works too.
