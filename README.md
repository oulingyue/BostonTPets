# BostonTPets

BostonHacks project: gacha pets you collect by scanning QR codes at T stations.
4 Boston animals (Duckling, Wild Turkey, Harbor Seal, Lobster) × 5 T line colors = 20 pets.

See [DESIGN.md](DESIGN.md) for the agreed game design.

## Progress

**Status:** app skeleton and scan backend are done; the database schema is next. Scanning isn't playable end-to-end yet.

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
- [ ] Database schema: tables, row-level security, the `record_scan` and `my_stats` functions, and seed codes for the demo poster
- [ ] Create the Supabase project, deploy the `scan` function, and test a scan end-to-end on a phone
- [ ] Print the demo poster: one QR code per station
- [ ] Mark the demo account (`profiles.is_demo = true`) for the live demo

## Stack

- **App:** Expo SDK 58 + Expo Router + TypeScript (`src/`)
- **Backend:** Supabase Auth + an Edge Function `scan` that rolls pets server-side (`supabase/functions/`)
- **Shared game logic:** `supabase/functions/_shared/game/` (catalog, odds, roll). The app imports it as `@game/*`.

## Run the app

Requires Node 22.18 or newer (check with `node -v`). Older versions can't run `npm run test:game`, because they don't run `.ts` files directly.

```sh
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npx expo start               # open in Expo Go on your phone
```

The camera works only on a physical device.

> Until the database schema lands (see [Progress](#progress)), sign-in works,
> but scanning and the collection screens will error because their tables don't exist yet.

### Preview without a backend

```sh
npm run preview:web
```

Runs the whole app in the browser on sample data, with no Supabase project and no `.env.local` needed. Scans are rolled locally with the real catalog odds.

### Windows

- **Shell:** the commands above work as written in Git Bash. In PowerShell, copy the env file with `Copy-Item .env.example .env.local`; in Command Prompt, use `copy .env.example .env.local`.
- **npm scripts:** on Windows, npm runs `package.json` scripts through Command Prompt, which doesn't understand `VAR=1 command`. To set an environment variable in a script, use `cross-env VAR=1 command`, as `preview:web` does.
- **Phone can't connect:** Windows Firewall blocks Expo's dev server unless Node.js is allowed on the network, and it's blocked by default on networks Windows treats as public, like most hackathon Wi-Fi. Allow Node.js when Windows asks, or run `npx expo start --tunnel`.

## Deploy the scan function

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy scan
```

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm run test:game   # roll odds + QR payload parsing (node:test)
```
