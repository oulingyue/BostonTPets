# BostonTPets

BostonHacks project: gacha pets you collect by scanning QR codes at T stations.
The skeleton has 4 Boston animals (Duckling, Wild Turkey, Harbor Seal, Lobster) × 5 T line colors = 20 pets. The planned roster is in [Loot table](#loot-table-planned).

See [DESIGN.md](DESIGN.md) for the agreed game design.

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
- [ ] Push Supabase migrations (`profiles` + game), deploy `scan` + `player`, and test a scan end-to-end on a phone
- [ ] (Optional) Tiger hypertable + demo codes for analytics — [tiger/README.md](tiger/README.md)
- [ ] Print the demo poster: one QR code per station
- [ ] Mark the demo account (`profiles.is_demo = true`) for the live demo
- [ ] Add Friends feature
- [ ] Refine Collections Page
- [ ] Leaderboard feature

## Loot table (planned)

The planned roster and odds. The code doesn't use them yet: `catalog.ts` and [DESIGN.md](DESIGN.md) still have the skeleton's 4 species × 5 lines.

Each T line gets its own creatures, and scanning a code on a line rolls from that line's table. The odds are the same on every line.

| Tier | Chance each | Red | Green | Orange | Blue | Silver |
| --- | --- | --- | --- | --- | --- | --- |
| **Legendary** | 2% | Lobster | Snapping Turtle | Red Fox | Humpback Whale | Snowy Owl |
| **Epic** | 4% | MIT Beaver | BU Terrier | Northeastern Husky | Harbor Seal | Atlantic Cod |
| **Epic** | 4% | Red-tailed Hawk | BC Eagle | Wentworth Leopard | Penguin | Peregrine Falcon |
| **Rare** | 10% | Alewife | Boston Terrier | Monarch Butterfly | Blue Jay | Herring Gull |
| **Rare** | 10% | Northern Cardinal | Swan | Orange Tabby Cat | Horseshoe Crab | Striped Bass |
| **Rare** | 10% | Raccoon | Bullfrog | Haymarket Rat | Piping Plover | Moon Jellyfish |

**Common (12% each, shared by every line):** Mallard Duck, Canada Goose, Wild Turkey, Pigeon, Gray Squirrel.

**Tier totals:** Common 60%, Rare 30%, Epic 8%, Legendary 2%.

**Line variants:** a line's own creatures (Rare, Epic and Legendary) have a 5% chance to come in that line's color. The shared commons never come in a line color.
- Red Line Alewife: 10% × 5% = 0.5%
- Red Line Lobster: 2% × 5% = 0.1% (1 in 1,000), the rarest roll in the game
- Overall, 2% of rolls are a line variant (40% line-specific × 5%).

**Pity:** an Epic or better is guaranteed within 10 rolls, and a Legendary by roll 60. With pity, players average about one Legendary every 35 rolls.

**Collection size:** 35 creatures plus 30 line variants (one for each of the 6 creatures on each line), 65 in total.

**Local tie-ins:**
- **Red:** Alewife, the last stop, is named after a fish. MIT is at Kendall/MIT.
- **Green:** the turtle is a joke about how slow the Green Line is. BU and BC are on the B branch. The swan is for the Public Garden swan boats, and the bullfrog for the Frog Pond.
- **Orange:** Northeastern and Wentworth are both at Ruggles. The rat is for Haymarket.
- **Blue:** the whale, seal and penguin are for Aquarium station and the whale watches. Piping plovers nest on Revere Beach.
- **Silver:** snowy owls spend winters at Logan Airport. The cod is for the Seaport fish pier.

**To implement:**
- `catalog.ts` would hold a creature list per line, plus the shared commons, instead of 4 species × 5 lines.
- `roll.ts` would roll from the scanned line's table, replacing the 70% line roll.
- Pity needs a per-user roll counter in the database. It's listed as out of scope in DESIGN.md.

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
npx supabase db push --remote                     # profiles + game tables on Supabase
npx supabase functions deploy scan player
```

Tiger (hypertable / prize demo): [tiger/README.md](tiger/README.md) — analytics copy, not required for the app to run.

## Checks

```sh
npm run typecheck   # tsc --noEmit
npm run test:game   # roll odds + QR payload parsing (node:test)
```