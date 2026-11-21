# BostonTPets: design

Collectible Boston pets. Ride the T, scan QR codes at stations, and collect pets in MBTA line colors.
Built for BostonHacks as an MVP that should keep growing afterwards.

## Core loop

1. Sign in (email + password).
2. Scan a BostonTPets QR code. Each code belongs to one station on one T line.
3. The **server** rolls a pet, and a fare-gate animation reveals it.
4. The pet lands in your collection. Duplicates level it up.

## Pets (20)

4 species × 5 subway lines. Placeholder art for the MVP is the species emoji on a circle in the line color.
Real art later: one base sprite per species, plus a color layer tinted with the line color in code.

| Species | Rarity | Weight | Emoji |
| --- | --- | --- | --- |
| Duckling | common | 45% | 🐥 |
| Wild Turkey | common | 35% | 🦃 |
| Harbor Seal | rare | 15% | 🦭 |
| Lobster | legendary | 5% | 🦞 |

Lines: Red `#DA291C`, Orange `#ED8B00`, Green `#00843D`, Blue `#003DA5`, Silver `#7C878E`.
Pet names are "Line + Species" (e.g. *Green Line Duckling*). Pun names may come later.

Source of truth: `supabase/functions/_shared/game/catalog.ts`. The app and the backend both import it.

## Roll rules (server-side only)

- **Line:** 70% the scanned code's line; otherwise one of the other 4 lines, chosen uniformly.
- **Species:** weighted by the rarity table above.
- **Gold:** 1% of any roll. Gold upgrades the existing slot permanently (still 20 slots), so "all gold" is an optional extra goal.
- **No pity system** for real players. Expected effort: about 130–230 scans to collect all 5 Lobsters.
- **Demo flag** (`profiles.is_demo`, set by admins only): Lobster 25%, gold 10%, and no cooldowns. It exists for live demos.

## Duplicates and levels

Level = copies, capped at ★5. Extra copies are counted (e.g. ★★★★★ +3). Levels are cosmetic only.

## Scan limits and code integrity

- **Per-code cooldown:** each user can scan a given code once every 24 h. Enforced in the database transaction.
- **Codes are opaque:** the QR payload is `btp:<32 hex chars>` (random). Station names aren't in the payload, so codes can't be guessed or forged. Clients can never list codes.
- **Transfer stations** get one code per line (Park Street has a Red code and a Green code).
- **Placement:** a demo poster at the hackathon, later partner businesses near stations. Posting stickers in stations would need MBTA permission.
- **Connectivity:** scanning requires network (no offline queue yet). Underground, the app shows "No signal — try again above ground."

## Screens

Bottom tabs: **Collection** (home), **Scan** (large center button), **Profile**.

- **Collection:** "X / 20 collected" plus 4 species cards. Each card has a dot per line: filled = collected, gold ring = gold. Tapping a card opens the species detail with all 5 line variants, stars, and the first-caught station and date.
- **Scan:** camera with a QR reticle. The camera unmounts when the tab isn't focused. Results:
  - success → fare-gate reveal (a CharlieCard taps, the gate light shows the rarity color or gold, the gates open, the pet springs in, with NEW! / TURNED GOLD! badges and stars)
  - cooldown → "Train already left 🚋 … next departure in Xh Ym"
  - not a BTP code / inactive code / network error → message + "Scan again"
- **Profile:** display name and email, stat tiles (collected, gold, scans, lines visited), scan history, and sign out.

## Architecture

```
Expo (SDK 58, Expo Router, TypeScript)          Supabase
┌───────────────────────────────┐               ┌────────────────────────────────────────────┐
│ src/app       screens         │  auth         │ Auth, profiles, game tables, record_scan   │
│ fetchProfile() ───────────────┼──────────────▶│ Edge Functions scan / player (service role)│
│ fetch* / submitScan() ────────┼──────────────▶│                                            │
└───────────────────────────────┘               └────────────────────────────────────────────┘
        ▲ imports @game/catalog                          │
        └──── supabase/functions/_shared/game ───────────┘
                                                      Tiger Data (optional): hypertable +
                                                      continuous aggregates fed from Supabase
                                                      for analytics / hackathon prize — see tiger/
```

Clients never write game state. Reads and writes go through Edge Functions (`player`, `scan`) using the service role on **Supabase Postgres**. Tiger is optional for time-series analytics (Supabase Edge cannot use Tiger free-tier TLS certs).

## Data model (Supabase Postgres)

- `profiles(id, display_name, is_demo)`: sign-up trigger. Clients read; update own `display_name` only.
- `scan_codes`, `user_pets`, `scans`: same shape as in `tiger/migrations/001_game.sql` (without Timescale).
- `record_scan(...)`, `my_stats(...)`: service role only; called from Edge Functions.

Tiger copy: [tiger/README.md](tiger/README.md).

## Out of scope for the MVP

Leaderboard, friends and trading, Apple/Google sign-in (needed before an App Store launch), offline scan queue, pity system, real art, GPS verification, and station-sign recognition.
