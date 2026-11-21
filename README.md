# BostonTPets

BostonHacks project: gacha pets you collect by scanning QR codes at T stations.
The repo still runs the **skeleton** (4 species × 5 lines = 20 pets). The **full roster** (65 slots, per-line tables, pity) is specified in [DESIGN.md](DESIGN.md).

See [DESIGN.md](DESIGN.md) for game design, loot tables, and the hackathon implementation order.

## Progress

**Status:** app wired to **Supabase** (auth, Postgres game data, `scan` + `player` Edge Functions). Push migrations, deploy functions, then test an end-to-end scan on a phone. Tiger Data is **optional** (analytics / MLH prize only).

### Done
- [x] Game design agreed (species, T lines, odds, gold, levels, cooldowns, screens). See [DESIGN.md](DESIGN.md)
- [x] Expo app scaffold (SDK 58, Expo Router, TypeScript)
- [x] Email + password sign-up / sign-in, with protected routes
- [x] Tabs: Collection, Scan (center button), Profile
- [x] Collection: "X / 20" summary, 4 species cards with line dots, and a species detail screen (stars, gold, first caught)
- [x] Scan: QR camera, a client-side `btp:` code check, and cooldown / invalid-code / no-signal messages
- [x] Fare-gate reveal animation (placeholder visuals)
- [x] Profile: stat tiles, scan history, sign out
- [x] Placeholder pet art: emoji on a circle in the line color
- [x] `scan` Edge Function: validates the code, rolls server-side, records via the `record_scan` RPC
- [x] Shared game catalog + roll logic, with tests for the odds

### Next
- [ ] Push Supabase migrations (`profiles` + game + `pet_id`), deploy `scan` + `player`, and test a scan end-to-end on a phone
- [ ] Print the demo poster: one QR code per station
- [ ] Mark the demo account (`profiles.is_demo = true`) for the live demo
- [ ] **MVP — Friends:** friend codes, requests, list, read-only friend collection ([DESIGN.md](DESIGN.md#friends-mvp))
- [ ] **MVP — Leaderboards:** collectors / gold / scans ([DESIGN.md](DESIGN.md#leaderboards-mvp))
- [ ] Refine Collection page
- [ ] (Optional) Tiger hypertable + demo codes for analytics — [tiger/README.md](tiger/README.md)

## Loot table

Documented in [DESIGN.md — Target design (full roster)](DESIGN.md#target-design-full-roster). Implementation checklist and priorities: [Hackathon plan](DESIGN.md#hackathon-plan-12-hours).

## Stack

- **App:** Expo SDK 58 + Expo Router + TypeScript (`src/`)
- **Backend:** Supabase Auth + Edge Functions (`scan`, `player`)
- **Game database (runtime):** Supabase Postgres — `profiles`, `scan_codes`, `user_pets`, `scans`, RPCs `record_scan` / `my_stats` ([supabase/migrations/](supabase/migrations/))
- **Tiger Data (optional):** time-series copy of `scans` for dashboards and the hackathon prize — not used by the app ([tiger/](tiger/))
- **Shared game logic:** `supabase/functions/_shared/game/` (catalog, odds, roll). The app imports it as `@game/*`.

### Teammates: one backend story

| Layer | Source of truth |
| --- | --- |
| Schema + demo QR codes | `supabase/migrations/` (demo codes are in `20251121210000_game.sql`) |
| Edge Functions | `supabase/functions/scan`, `supabase/functions/player` |
| App env | `.env.local` from [.env.example](.env.example) — **Supabase URL + publishable key only** (no Tiger URL in the app) |
| Tiger | Same table shapes as Supabase + Timescale extras in `tiger/migrations/001_game.sql`; sync `record_scan` body if you change the RPC on Supabase |

Edge Functions **cannot** connect to Tiger free-tier TLS (`CaUsedAsEndEntity`), so game writes stay on Supabase. See [tiger/README.md](tiger/README.md) to replicate `scans` into Tiger for charts.

## Run the app

Requires Node 22.18 or newer (check with `node -v`). Older versions can't run `npm run test:game`, because they don't run `.ts` files directly.

```sh
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npx expo start               # open in Expo Go on your phone
```

The camera works only on a physical device.

> Scanning and collection need Supabase migrations applied and Edge Functions deployed (see below).

### Preview without a backend

```sh
npm run preview:web
```

Runs the whole app in the browser on sample data, with no Supabase project and no `.env.local` needed. Scans are rolled locally with the real catalog odds.

### Windows

- **Shell:** the commands above work as written in Git Bash. In PowerShell, copy the env file with `Copy-Item .env.example .env.local`; in Command Prompt, use `copy .env.example .env.local`.
- **npm scripts:** on Windows, npm runs `package.json` scripts through Command Prompt, which doesn't understand `VAR=1 command`. To set an environment variable in a script, use `cross-env VAR=1 command`, as `preview:web` does.
- **Phone can't connect:** Windows Firewall blocks Expo's dev server unless Node.js is allowed on the network, and it's blocked by default on networks Windows treats as public, like most hackathon Wi-Fi. Allow Node.js when Windows asks, or run `npx expo start --tunnel`.

## Deploy backend

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --remote                     # profiles + game + pet_id migration on Supabase
npx supabase functions deploy scan player
```

Tiger (hypertable / prize demo): [tiger/README.md](tiger/README.md) — analytics copy, not required for the app to run.

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm run test:game   # roll odds + QR payload parsing (node:test)
```