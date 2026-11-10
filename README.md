# AirMon: Air Quality Monitor Dashboard

Live dashboard for the Assignment 2 air-quality prototype. An ESP32 node reads the
MQ-135 (gas), DHT11 (temperature + humidity) and LDR (light) every 5 seconds and
POSTs each reading to a Supabase `log` table; this Next.js app polls the last 3
hours of that table every 10 seconds and shows the verdict, sensors,
5-minute-bucketed charts and history.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` (or `.env`) and fill both values from
   **Supabase Dashboard > Project Settings > API**, the same URL and publishable
   key the firmware already uses:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   The publishable/anon key is safe in the browser: RLS on `log` allows SELECT only.

3. Run:

   ```bash
   npm run dev       # dashboard at http://localhost:3000
   npm test          # 28 unit tests (domain rules, chart series, demo data, poller)
   npm run typecheck # strict tsc, no emit
   npm run build     # production build
   ```

Without env vars the dashboard renders a deterministic demo dataset (with a
banner), so the UI works before Supabase is connected.

## Data contract

Table `log`, one row per 5-second reading (written by `monitor_udara_supabase.ino`):

| Column   | Type        | Meaning                                        |
| -------- | ----------- | ---------------------------------------------- |
| `ts`     | timestamptz | Row time, set by Postgres `now()`              |
| `gas`    | int         | MQ-135 raw ADC 0–4095 (≥700 SEDANG, ≥1200 BURUK) |
| `temp`   | float       | Temperature °C                                 |
| `hum`    | float       | Relative humidity %RH                          |
| `ldr`    | int         | LDR raw ADC (>3500 = night)                    |
| `fan`    | int 0/1     | Fan actuator state                             |
| `status` | text        | `BAIK` / `SEDANG` / `BURUK`                    |

## Structure

- `lib/air.ts`: domain rules, thresholds, formatters, 5-minute chart series (one source of truth)
- `lib/supabase.ts`: Supabase client + the one 3-hour window query (paged past the 1,000-row cap)
- `lib/poll.ts`: interval poller (framework-free, fake-timer testable)
- `lib/demo.ts`: deterministic demo dataset
- `hooks/use-air-data.ts`: React polling state
- `components/`: status pill, KPI strip, chart, history table, connection stamp
- `app/`: layout, page, design tokens (data-terminal style via the repo's design-taste-frontend skill)
- `tests/`: Vitest unit tests
