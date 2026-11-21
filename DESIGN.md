# BostonTPets: design

Collectible Boston pets. Ride the T, scan QR codes at stations, and collect pets in MBTA line colors.
Built for BostonHacks as an MVP that should keep growing afterwards.

## Core loop

1. Sign up (display name, unique @username, email, password) or sign in.
2. Scan a BostonTPets QR code. Each code belongs to one station on one T line.
3. The **server** rolls a pet, and a fare-gate animation reveals it.
4. The pet lands in your collection. Duplicates level it up.

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
- **Profile:** avatar, display name, @username, last active and joined date, Pets / Following / Followers counts, an **Add friends** button, stat tiles (collected, gold, scans, lines visited), then a **Pets | History** toggle. Pets is a grid of owned pets; History is the scan history. Sign out at the bottom.
- **Pet sheet:** tapping any pet opens a bottom sheet with its level (copies, capped at ★5, extras counted), first caught date, gold status and permanent pet ID. It never shows the station, because the same sheet is used on other people's profiles.
- **Add friends:** search by username prefix (3+ characters, up to 20 results). Each result has a Follow button.
- **Someone's profile** (`/user/<handle>`): the same header with a Follow / Following button and their pet grid. No email, scan history or stations.
- **Following / Followers** (`/user/<handle>/follows`): two tabs of people, each with a Follow button.

## Following

- **One-way follow**, no approval, like Instagram. The UI says "Following" and "Followers", shows a "Follows you" tag, and labels the button "Follow back" when they already follow you.
- **Profiles are public** to every signed-in user: display name, username, last active, joined date, follow counts, stats and pets. Email, scan history and stations are never shown to anyone else, since stations reveal where someone rides.
- **Usernames** are unique, lowercase, 3–20 characters of `a–z`, `0–9` and `_` (`src/lib/handle.ts`). They are chosen at sign-up, with a live availability check.
- **Last active** is set by the backend when the app opens or comes to the foreground (`touch`), not taken from Supabase's last sign-in, which goes stale because the app keeps you signed in.

## Architecture

```
Expo (SDK 58, Expo Router, TypeScript)          Supabase
┌───────────────────────────────┐               ┌──────────────────────────────────────┐
│ src/app       screens         │  auth         │ Auth (email + password)              │
│ src/lib/api   reads own rows ─┼──────────────▶│ Postgres + RLS (read own rows only)  │
│ submitScan(payload) ──────────┼──────────────▶│ Edge Function `scan`                 │
└───────────────────────────────┘               │   validate code → rollPet() →        │
        ▲ imports @game/catalog                 │   rpc record_scan (atomic cooldown + │
        └──── supabase/functions/_shared/game ──┤   insert + upsert)                   │
                                                └──────────────────────────────────────┘
```

Clients never write game state. All writes go through the `scan` Edge Function, which uses the service role.

Profiles, search and follows go through a second Edge Function, `social`. It takes `{ action, ...params }` and the actions are listed at the top of the social section in `src/lib/api.ts`. The game database is Postgres hosted on Tiger Data; Supabase provides auth and the Edge Functions.

## Data model (follow-up PR)

- `profiles(id, display_name, handle, is_demo, created_at, last_active_at)`: created by a trigger on sign-up, which copies `display_name` and `handle` from the sign-up metadata. `handle` is unique and must match `^[a-z0-9_]{3,20}$`. Clients may update only `display_name`.
- `scan_codes(id, station_name, line, active)`: no client access.
- `user_pets(id uuid, user_id, species, line, copies, is_gold, first_caught_at, first_station)`: PK (user, species, line); `id` is unique and shown as the pet ID. Read-own; other people's pets are served without `first_station` by `social`.
- `scans(id, user_id, code_id, station_name, code_line, species, line, is_gold, created_at)`: read-own. Drives cooldowns, history, and stats.
- `record_scan(...)`: service-role-only RPC. Takes an advisory lock per (user, code), checks the cooldown, inserts the scan, and upserts the pet.
- `my_stats()`: security-invoker RPC returning `total_scans` and `lines_visited`.
- `follows(follower_id, followee_id, created_at)`: PK (follower, followee), with a check that you can't follow yourself. Written only through `social`.

## Out of scope for the MVP

Leaderboard, trading, Apple/Google sign-in (needed before an App Store launch), offline scan queue, pity system, real art, GPS verification, and station-sign recognition.
