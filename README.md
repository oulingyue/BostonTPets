# BostonTPets

BostonHacks project: gacha pets you collect by scanning QR codes at T stations.
The roll is the **full roster** (35 pets, per-line tables, pity). Collection layout and art are still placeholders. Spec: [DESIGN.md](DESIGN.md).

See [DESIGN.md](DESIGN.md) for game design, loot tables, and the hackathon implementation order.

## Progress

**Status:** app wired to **Supabase** (auth, Postgres game data, `scan`, `player` and `social` Edge Functions). Push migrations, deploy functions, then test an end-to-end scan on a phone. Tiger Data is **optional** (analytics / MLH prize only).

### Done
- [x] Game design agreed (species, T lines, odds, gold, levels, cooldowns, screens). See [DESIGN.md](DESIGN.md)
- [x] Expo app scaffold (SDK 58, Expo Router, TypeScript)
- [x] Email + password sign-up / sign-in, with protected routes
- [x] Tabs: Collection, Scan, Leaders, Profile
- [x] Collection: "X / 35" summary and a temporary rarity-grouped list (layout still belongs to the collection teammate)
- [x] Scan: QR camera, a client-side `btp:` code check, and cooldown / invalid-code / no-signal messages
- [x] Fare-gate reveal animation (placeholder visuals)
- [x] Profile: @username, stat tiles, Pets | History, pet sheet, sign out
- [x] Following: username search, follow / unfollow, other people's profiles and pets (`social` Edge Function + `follows` table)
- [x] Placeholder pet art: emoji on a circle in the line color
- [x] `scan` Edge Function: validates the code, rolls server-side, records via the `record_scan` RPC
- [x] Full-roster catalog, per-line roll, and hard pity (`roll_pity`), with tests in `npm run test:game`
- [x] Leaderboards: points per scan (rarity, new vs duplicate, gold, daily bonus), Global and Friends boards, points on the reveal and profile ([DESIGN.md](DESIGN.md#leaderboards-mvp))

### Next
- [ ] Push Supabase migrations (including `roll_pity`, `follows` and `leaderboard`), deploy `scan`, `player` and `social`, and test a scan and a follow end-to-end on a phone. Wipe `user_pets` / `scans` if they still hold skeleton ids like `red_lobster`.
- [ ] Print the demo poster: one QR code per station
- [ ] Mark the demo account (`profiles.is_demo = true`) for the live demo
- [ ] Refine Collection page
- [ ] (Optional) Tiger hypertable + demo codes for analytics — [tiger/README.md](tiger/README.md)

## Loot table

Implemented in `supabase/functions/_shared/game/catalog.ts` and `roll.ts`. Odds, pity reset, and the `getPet` / `CATALOG` / `TOTAL_PETS` contract: [DESIGN.md — Target design](DESIGN.md#target-design-full-roster).

## Duplicates and levels
Level = copies, capped at ★5. Extra copies are counted (e.g. ★★★★★ +3). Levels are cosmetic only.

## Stack

- **App:** Expo SDK 58 + Expo Router + TypeScript (`src/`)
- **Backend:** Supabase Auth + Edge Functions (`scan`, `player`, `social`)
- **Game database (runtime):** Supabase Postgres — `profiles`, `scan_codes`, `user_pets`, `scans`, RPCs `record_scan` / `my_stats` / `leaderboard`, `follows` ([supabase/migrations/](supabase/migrations/))
- **Tiger Data (optional):** time-series copy of `scans` for dashboards and the hackathon prize — not used by the app ([tiger/](tiger/))
- **Shared game logic:** `supabase/functions/_shared/game/` (catalog, odds, roll). The app imports it as `@game/*`.

### Teammates: one backend story

| Layer | Source of truth |
| --- | --- |
| Schema + demo QR codes | `supabase/migrations/` (demo codes are in `20251121210000_game.sql`) |
| Edge Functions | `supabase/functions/scan`, `supabase/functions/player`, `supabase/functions/social` |
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

Runs the whole app in the browser on sample data, with no Supabase project and no `.env.local` needed. Scans are rolled locally with the real catalog odds. `npm run preview` does the same in Expo Go on your phone, which is where haptics and real performance show up.

### Reveal playground

Open `/dev/reveal`, or tap **Reveal playground** at the bottom of the Profile tab. It's available in every build, including production, so you can show it on any phone. Pick any line and creature from the catalog, choose what the pull does (new pet, duplicate, level up, max level), toggle gold, roll a random pull with the real odds and pity, and replay at 1×, ½× or ¼× speed. Every save replays the reveal. The reveal lives in `src/components/reveal/`: timings are `T`, rarity colors are `RARITY_COLOR`, and the pixel sprites are in `sprites.ts`.

### Sound effects

The reveal, level-ups, tapping your pet, and opening pets in the collection all play 8-bit sound effects (`src/lib/sfx.ts`). They mix with the player's music and play even when the phone is on silent or vibrate (they use the media volume). The sounds are synthesized by `scripts/sfx/generate.mjs`, so they're original and license-free: edit a recipe there and run `npm run sfx` to regenerate `assets/sfx/`.

### Windows

- **Shell:** the commands above work as written in Git Bash. In PowerShell, copy the env file with `Copy-Item .env.example .env.local`; in Command Prompt, use `copy .env.example .env.local`.
- **npm scripts:** on Windows, npm runs `package.json` scripts through Command Prompt, which doesn't understand `VAR=1 command`. To set an environment variable in a script, use `cross-env VAR=1 command`, as `preview:web` does.
- **Phone can't connect:** Windows Firewall blocks Expo's dev server unless Node.js is allowed on the network, and it's blocked by default on networks Windows treats as public, like most hackathon Wi-Fi. Allow Node.js when Windows asks, or run `npx expo start --tunnel`.

## Adding pet art

Creatures show their emoji until they have art. The style is cute 16-bit pixel art.

Every pet is drawn in code by `scripts/pixel-pets/generate.mjs`: each is a 32×32 sprite built from shapes (birds, sitting critters, and fish share templates), with shading, outlines, and a blink frame. Edit a pet there and run `npm run pets` to regenerate its PNGs and `src/lib/pixelPetArt.ts`. To replace a pet with hand-made art instead:

1. Save a square PNG with a transparent background as `assets/pets/<id>.png`. The id is the creature's id in `catalog.ts`, such as `lobster` or `mit_beaver`.
2. Add it to `HAND_MADE` in `src/lib/petArt.ts`, which overrides the generated art. The app then shows it everywhere: collection, history, and the pull reveal.
3. Optional: an eyes-closed version saved as `assets/pets/<id>-blink.png`, and added as `blink`, makes the pet blink.

## Deploy backend

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --remote                     # profiles + game + pet_id migration on Supabase
npx supabase functions deploy scan player social
```

Deploy the functions right after `db push`: the leaderboard migration changes `record_scan`'s parameters, so the old `scan` function and the new database (or the other way round) can't record scans.

Tiger (hypertable / prize demo): [tiger/README.md](tiger/README.md) — analytics copy, not required for the app to run.

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm run test:game   # roll odds, QR payload parsing, leveling (node:test)
```