# Momentum

A personal daily-tasks + goals app. Small daily tasks roll up into long-term goals, so finishing
today's list visibly moves the big things.

Built with Next.js 16, Cloudflare Workers + D1 (via OpenNext), zod, Tailwind CSS 4, Recharts and
TanStack Query. Installable as a PWA with offline viewing and ticking.

Live: https://momentum.ourhearts-mza.workers.dev

## Quick start (local)

```bash
npm install
npm run db:migrate          # create the local D1 database
npm run seed                # optional: 60 days of demo data (local only)
npm run dev                 # http://localhost:3000, password "momentum"
```

Wrangler and OpenNext need Node 22+. On older Node the scripts run a cached Node 22 via
`npx node@22` automatically (`scripts/node22.sh`).

| Script                      | What it does                                                         |
| --------------------------- | -------------------------------------------------------------------- |
| `npm run dev`               | Dev server with the local D1 database                                |
| `npm run deploy`            | Build for Workers and deploy to Cloudflare                           |
| `npm run preview`           | Build for Workers and run that build locally (http://localhost:8787) |
| `npm run db:migrate`        | Apply `migrations/` to the local database                            |
| `npm run db:migrate:remote` | Apply `migrations/` to the deployed database                         |
| `npm run seed`              | **Wipes** the local database and loads demo data (never remote)      |
| `npm run reset`             | **Wipes** the local database, keeps the default areas                |
| `npm run reset -- --remote` | **Wipes the deployed app's data** (asks you to type `delete`)        |
| `npm test`                  | Unit + integration tests (Vitest)                                    |

## Deploying

The app runs as the Cloudflare Worker `momentum` with the D1 database `momentum` (see `wrangler.jsonc`).
Secrets are set once on Cloudflare, not in the repo:

```bash
npm run wrangler -- secret put APP_PASSWORD     # your login password
openssl rand -hex 32 | npm run wrangler -- secret put SESSION_SECRET
```

Then `npm run deploy` for every update. Schema changes go in a new file under `migrations/`
followed by `npm run db:migrate:remote`.

## Configuration

Locally, `.env` (for `npm run dev`) and `.dev.vars` (for `npm run preview`); on Cloudflare, Worker secrets:

- `APP_PASSWORD`: the single user's password. In development it defaults to `momentum` if unset.
- `SESSION_SECRET`: signs the session cookie. Required in production.

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

Open https://momentum.ourhearts-mza.workers.dev in Chrome, sign in, then menu → *Install app*. Offline: previously visited screens load from cache, and completing or
editing tasks is queued and synced when the connection returns.

## Project layout

```
src/
  app/(app)/…        pages (client components that only talk to /api)
  app/api/…          REST route handlers (zod-validated)
  app/focus          full-screen focus timer
  lib/server/        D1 access, rollover, habits, goals, stats, review, backup, auth
  lib/shared/        dates (Karachi tz), quick-add parser, metrics (pace, streaks), schemas, types
  lib/client/        fetch + offline queue, React Query hooks, focus timer state, theme
  components/        UI
public/sw.js         service worker
migrations/          D1 schema
scripts/             seed, reset, Node 22 wrapper
```

## Wrapping with Capacitor later

All pages are static client components that fetch from `/api`, so the UI can be exported and
wrapped. Point it at your server with `NEXT_PUBLIC_API_URL=https://your-host` (requests send
credentials; the server will need CORS and a `SameSite=None; Secure` cookie for a cross-origin shell).

## Backups

Settings → Backup exports everything as JSON; importing replaces all data in one batch.
Cloudflare D1 also keeps 30 days of point-in-time recovery (`wrangler d1 time-travel`).
