# BostonTPets: design

Collectible Boston pets. Ride the T, scan QR codes at stations, and collect creatures tied to each line and to the city.
Built for BostonHacks; the repo should stay playable after the event.

**Source of truth for game data (in code):** `supabase/functions/_shared/game/catalog.ts` and `roll.ts`.  
Those files implement the full roster and pity rules below. Collection and art should read `getPet(petId)`, `CATALOG`, and `TOTAL_PETS`.

---

## Core loop

1. Sign up (display name, unique @username, email, password) or sign in.
2. Scan a BostonTPets QR code. Each code belongs to one station on one T line.
3. The **server** rolls a pet from that line's table (and pity rules when enabled), then the fare-gate animation reveals it.
4. The pet lands in your collection under a stable **`pet_id`**. Drawing the same `pet_id` again is a **duplicate**: copies go up and the pet gains EXP toward its next level (no second slot).

---

## Pet identity (`pet_id`)

Every collectible in the game is exactly one row in the catalog with a **globally unique** `pet_id` (stable slug, e.g. `mallard_duck`, `alewife`).

| Concept | Meaning |
| --- | --- |
| **`pet_id`** | The drawable collectible. **35** ids. |
| **Collection slot** | At most one `user_pets` row per `(user_id, pet_id)`. |
| **Duplicate draw** | Same `pet_id` rolled again → increment `copies`, run gold merge; the duplicate adds EXP and may level the pet up. |
| **`scans.id`** | Every scan is its own event (audit / history). Many scans can reference the same `pet_id`. |

Rules:

- Two different `pet_id`s are always different collectibles.
- **Shared commons** use one `pet_id` for all lines (e.g. `mallard_duck` whether you scanned on Red or Green).
- **Line-exclusive** creatures use one `pet_id` per creature (`lobster`, `alewife`).

Roll output always includes `pet_id`. `record_scan` upserts on `(user_id, pet_id)`.

---

## Shipped today

`catalog.ts`, `roll.ts`, and `record_scan` implement the [loot table](#loot-table) and [pity](#pity-target) below.

- **Collection size:** **35** `pet_id`s (5 shared commons + 30 line-exclusives).
- **Line roll:** the scanned code's line only.
- **Gold:** 1% on any roll; upgrades that slot permanently.
- **Pity:** `roll_pity.since_epic_plus` / `since_legendary`, updated inside `record_scan` (migration `20251122100000_roll_pity.sql`). See [Pity](#pity-target).
- **UI:** Collection is a temporary rarity-grouped list (`X / 35`) so the new ids render. Filters and layout belong to the collection teammate. Art is still the catalog emoji; sprites can key off `petId`.
- **Old rows:** skeleton ids such as `red_lobster` are not migrated. Wipe `user_pets` and `scans` on a database that already has them.

Demo accounts (`profiles.is_demo`, admin-only): legendary weight **22** (commons drop from 12 to 8), 10% gold, **no scan cooldowns**, **pity off**. Config: `DEMO_ODDS`.

---

## Target design (full roster)

Agreed direction for the rest of the hackathon and beyond. Odds are **per scanned line**: the QR's line picks the table; there is no cross-line species roll.

### Lines

Red `#DA291C`, Orange `#ED8B00`, Green `#00843D`, Blue `#003DA5`, Silver `#7C878E`.

### Loot table

Each line has six line-specific creatures (two Epic, three Rare, one Legendary). Five **commons** are shared on every line (12% each).

| Tier | Chance each | Red | Green | Orange | Blue | Silver |
| --- | --- | --- | --- | --- | --- | --- |
| **Legendary** | 2% | Lobster | Snapping Turtle | Red Fox | Humpback Whale | Snowy Owl |
| **Epic** | 4% | MIT Beaver | BU Terrier | Northeastern Husky | Harbor Seal | Atlantic Cod |
| **Epic** | 4% | Red-tailed Hawk | BC Eagle | Wentworth Leopard | Penguin | Peregrine Falcon |
| **Rare** | 10% | Alewife | Boston Terrier | Monarch Butterfly | Blue Jay | Herring Gull |
| **Rare** | 10% | Northern Cardinal | Swan | Orange Tabby Cat | Horseshoe Crab | Striped Bass |
| **Rare** | 10% | Raccoon | Bullfrog | Haymarket Rat | Piping Plover | Moon Jellyfish |

**Commons (12% each, every line):** Mallard Duck, Canada Goose, Wild Turkey, Pigeon, Gray Squirrel.

**Tier totals per roll:** Common 60%, Rare 30%, Epic 8%, Legendary 2%.

**Collection size:** **35** unique `pet_id`s — 5 shared commons + 30 line-exclusives. Display names come from catalog metadata per `pet_id`.

### Pity (target)

Track per-user counters on the server (not client):

- **Epic+:** guaranteed within **10** rolls without Epic or better.
- **Legendary:** guaranteed by roll **60** without a Legendary.

Pity resets from the creature's rarity (gold does not change it). Documented in `roll.ts`:

- Legendary (natural or pity) → both counters `0`.
- Epic → `sinceEpicPlus = 0`, `sinceLegendary += 1`.
- Rare or common → both counters `+= 1`.
- If both guarantees are due, Legendary wins.

Epic pity draws that line's two epics and its legendary at **4:4:2**, so some guaranteed Epic+ rolls are legendaries. With both guarantees, expect about one Legendary every **~28** rolls (`roll.test.ts`). A flat 2% capped at 60, ignoring those extra legendaries, would be ~35.

### Gold (unchanged intent)

**1%** on any roll upgrades the **collection slot** that received the pet. "All gold" remains an optional completion goal.

Demo accounts: higher gold rate and no cooldowns; pity may be disabled or relaxed for booth demos (config in `DEMO_ODDS`).

### Local flavor (pitch notes)

- **Red:** Alewife station; MIT at Kendall/MIT.
- **Green:** snapping turtle / slow Green Line; BU, BC, swan boats, Frog Pond.
- **Orange:** Northeastern and Wentworth at Ruggles; Haymarket rat.
- **Blue:** Aquarium, harbor wildlife, Revere Beach plovers.
- **Silver:** Logan snowy owls; Seaport cod.

### Art

Placeholder: emoji on a circle tinted with the creature's line color (shared commons stay neutral).  
Later: one sprite per creature.

---

## Roll rules (server-side only)

| Rule | Implemented |
| --- | --- |
| Table | Roll only from **scanned line's** table |
| Gold | 1% (10% on demo accounts) |
| Pity | Epic+ @ 10, Legendary @ 60 (off for demo accounts) |
| RNG | `roll.ts` in the `scan` Edge Function; clients never choose the outcome |

Clients never choose outcomes. `scan` calls `record_scan` after a successful roll.

---

## Duplicates and levels

- First time you roll a `pet_id`: **new** slot, `copies = 1`, store `first_station` / `first_caught_at`.
- Same `pet_id` again: **duplicate** — `copies += 1`, and the duplicate gives EXP: common 25, rare 50, epic 100, legendary 175. Levels need 100 / 150 / 200 / 250 EXP, up to ★5 (700 EXP). Level and EXP come from duplicate EXP plus optional **`bonus_exp`** on equipped pets (`_shared/game/leveling.ts`). Cosmetic only.
- The pull reveal fills the EXP bar; each full bar plays a level-up (banner, rising arrows, a new star) and carries the rest into the next level.
- Gold on a duplicate still upgrades that slot (`is_gold` sticks).

Never create a second collection row for the same `pet_id`.

---

## Scan limits and code integrity

- **Per-code cooldown:** one scan per user per code every **24 h** (skipped when `profiles.is_demo`).
- **Location check:** a code with coordinates (`scan_codes.lat`, `lng`, `radius_m`, default **250 m**) only counts if the phone is within the radius. The phone's reported accuracy adds up to **150 m** of slack, since GPS fails underground. Mock locations are refused. Codes without coordinates skip the check, and so do demo accounts. Rules: `_shared/game/location.ts`. The phone reports its own position, so this stops casual cheating, not someone who forges API requests.
- **Payload:** `btp:<32 hex>` — opaque ID; station is resolved server-side from `scan_codes`.
- **Transfer stations:** one code per line (e.g. Park Street Red vs Green).
- **Placement:** hackathon poster; later partners near stations. In-station stickers need MBTA permission.
- **Connectivity:** online only; show "No signal — try again above ground" when the request fails.

---

## Screens

Tabs: **Habitat**, **Collection**, **Scan**, **Profile**. The app opens on Habitat. Social screens open from Profile; there is no separate Friends tab.

### Habitat

The first screen is one pixel scene, not three cards. Sky, earth, and water meet at a tree and a shore. The picture uses flat pastel blocks and small diamond sparkles, in the same cute sticker-pixel style as the pet art. Pets are the existing sprites.

Each band holds **one** pet the player owns:

- **Sky:** flying birds and the monarch butterfly.
- **Water:** swimmers, including ducks, geese, swans, the penguin, the seal, the turtle, and the frog.
- **Earth:** walkers, including the wild turkey.

A plus on an empty band opens that zone's pets. After a pet is placed, tap it to swap or unequip; the plus is gone until the band is empty again. Rows live in `habitat_pets` (`20261121210000_habitat.sql`); the zone of each `pet_id` is `HABITAT_OF` in `catalog.ts`.

**Equip** is the same system: at most one pet in **air** (sky), **land** (earth), and **water**. Equip from the habitat home, the habitat picker, or a pet's sheet in Collection / Profile (`set_habitat_pet`). Equipped pets earn **passive EXP** stored on `user_pets.bonus_exp` (`20261122200000_passive_exp.sql`): **20 EXP/day** while equipped (~5 days for the first 100 EXP bar), synced when pets load or the app comes to the foreground. Offline accrual is capped at **7 days**. Passive EXP counts toward the same level bars as duplicate EXP (`leveling.ts`); it does not affect leaderboard points.

**MVP includes** following (search, follow, view other people's profiles and pets) and leaderboards. Following is built (app + `social` Edge Function + `follows` table). Leaderboards are spec only.

### Collection

- **Skeleton:** "X / 20", four species cards, dots per line (filled = collected, gold ring = gold), species detail, stars, first-caught station and date.
- **Target:** "X / 35", grouped by **tier** and/or **line** (filter chips). Detail: stars, gold ring, first station, first caught date.
- **Refine (stretch):** search, "missing only", line-colored progress rings.

### Scan

Camera + reticle; unmount when tab blurs.

- Success → fare-gate reveal (a CharlieCard taps, the gate light shows the rarity color or gold, the gates open, the pet springs in; NEW! / TURNED GOLD! as needed).
- Cooldown → "Train already left 🚋 … next departure in Xh Ym".
- Too far from the code → "Wrong stop 📍 … your phone puts you 2.3 mi away" (with Open Settings if only approximate location is shared).
- No location for a located code → "Location needed 📍" + Allow location / Open Settings, or "Can't find you 📍" if location is on but no fix came.
- Invalid / inactive code / offline → message + Scan again.

The app asks for location ("while using") the first time a scan needs it, and keeps a fresh fix while the Scan tab is open.

### Profile

Avatar, display name, @username, last active and joined date, Pets / Following / Followers counts, an **Add friends** button, stat tiles (collected, gold, scans, points), then a **Pets | History** toggle. Pets is a grid of owned pets; History is the scan history (own profile only). Leaderboards have their own tab. Sign out at the bottom.

- **Pet sheet:** tapping any pet opens a bottom sheet with its level (copies, capped at ★5, extras counted), first caught date and gold status. It never shows the station, because the same sheet is used on other people's profiles.
- **Add friends:** search by display name (contains, case-insensitive, 3+ characters, up to 20 results; names that start with the query come first). Each result has a Follow button.
- **Someone's profile** (`/user/<handle>`): the same header with a Follow / Following button and their pet grid. No email, scan history or stations.
- **Following / Followers** (`/user/<handle>/follows`): two tabs of people, each with a Follow button.

### Following (MVP)

**Goals:** ride with classmates, compare collections, light social proof for the hackathon demo.

- **One-way follow**, no approval, like Instagram. The UI says "Following" and "Followers", shows a "Follows you" tag, and labels the button "Follow back" when they already follow you.
- **Profiles are public** to every signed-in user: display name, username, last active, joined date, follow counts, stats and pets. Email, scan history and stations are never shown to anyone else, since stations reveal where someone rides.
- **Usernames** are unique, lowercase, 3–20 characters of `a–z`, `0–9` and `_` (`src/lib/handle.ts`). They are chosen at sign-up, with a live availability check.
- **Last active** is set by the backend when the app opens or comes to the foreground (`touch_last_active`), not taken from Supabase's last sign-in, which goes stale because the app keeps you signed in.
- **Profile picture:** optional `profiles.avatar_pet_id` (must be owned). Shown on profile, search, follows, and leaderboard; otherwise initials (`set_avatar_pet` RPC).

**Not in MVP:** trading/gifting pets, blocking, DMs, activity feed.

**API shape:** Edge Function `social` (`supabase/functions/social`) taking `{ action, ...params }`; the actions are listed at the top of the social section in `src/lib/api.ts`. RLS stays read-own: other people's pets and profiles are served by `social` with the service role, without `first_station`.

### Leaderboards (MVP)

**Goals:** arcade-style ranking for the pitch, and a reason to ride (and scan) every day.

A **Leaderboard** tab (Collection | Scan | Leaderboard | Profile; Scan is a normal tab icon now that there are four) with a **Global | Friends** toggle. One board, ranked by **points**. Collectors / gold / scans stay as profile stats rather than separate boards.

**Points** (`_shared/game/points.ts`), earned by every scan:

| | Common | Rare | Epic | Legendary |
| --- | --- | --- | --- | --- |
| New pet | 25 | 50 | 100 | 175 |
| Duplicate (40%) | 10 | 20 | 40 | 70 |

- **Gold ×2** on the rarity points (new or duplicate).
- **+50 daily bonus** on your first scan of the day, added after the gold multiplier. A day is a calendar day in **Boston time** (midnight ET) for everyone.
- New-pet values match the duplicate EXP scale on purpose: one set of numbers to learn.
- Points are stored per scan (`scans.points`), so changing the numbers later doesn't rescore old scans.

**Boards** (all-time; no season reset):

- **Global:** every player with more than 0 points. Top **50**.
- **Friends:** you plus everyone you follow (one-way, so it works before anyone follows you back), including people with 0 points.
- **Demo accounts** (`is_demo`) are ranked like everyone else, so the booth account shows on Global during the live demo.
- Your own row is highlighted, and pinned below the list when you're outside the top 50. On Global with no points yet, the pin says "Scan a code to get on the board".
- An **ⓘ** button at the top right of the header opens a closable sheet explaining the points rules (table, gold, daily bonus, who is on each board).
- Rows: rank (medals for the top 3), avatar, name, @handle, pet count, points. Tapping a row opens that profile.
- **Ties:** whoever reached the score first (earlier last scan), then earlier sign-up.

**Elsewhere:** the pull reveal shows "+N PTS" (and "incl. +50 daily"); profiles have a **Points** stat tile; the reveal playground has a **Daily bonus** toggle.

**API:** `player` resource `leaderboard` with `scope: 'global' | 'friends'` → `{ entries, me }`, backed by the service-role `leaderboard(p_viewer, p_scope, p_limit)` RPC (migration `20261122220000_leaderboard_include_demo.sql`). It returns public fields only (handle, display name, points, pet count).

**Tiger (optional later):** weekly board from continuous aggregates; not required for MVP.

--- | --- |
| **Collectors** | Distinct `pet_id` count (unique slots) |
| **Gold** | Count of `user_pets` where `is_gold` |
| **Scans** | Total scans (`my_stats.total_scans` or `count(scans)`) |

- Show **top 50** + **highlight current user** row (rank + value) even if not in top 50.
- Display name on rows; no email. Tie-break: earlier `profiles.created_at` or higher user id — pick one in SQL and document it.

**API shape (planned)**

- `player` resource `leaderboard` with `board: 'collectors' | 'gold' | 'scans'`.
- Implement as SQL views or security-definer RPCs reading aggregates only (no per-user pet leakage except public stats fields).

**Tiger (optional later):** weekly scans board from continuous aggregates; not required for MVP.

---

## Architecture

```
Expo (SDK 58, Expo Router, TypeScript)          Supabase
┌───────────────────────────────┐               ┌────────────────────────────────────────────┐
│ src/app       screens         │  auth         │ Auth, profiles, game tables, record_scan   │
│ fetchProfile() ───────────────┼──────────────▶│ Edge Functions scan / player (service role)│
│ fetch* / submitScan() ────────┼──────────────▶│                                            │
└───────────────────────────────┘               └────────────────────────────────────────────┘
        ▲ imports @game/*                                │
        └──── supabase/functions/_shared/game ───────────┘
                                                      Tiger (optional): analytics copy — tiger/
```

Runtime game DB is **Supabase Postgres**. Tiger is optional (MLH analytics); Edge Functions do not write to Tiger directly.

Profiles, search and follows go through a third Edge Function, `social`. Two small RPCs are called directly by the app: `handle_available` (works signed out, for the sign-up form) and `touch_last_active`.

---

## Data model

### Current (Supabase)

- `profiles(id, display_name, handle, is_demo, created_at, last_active_at)`: created by a trigger on sign-up, which copies `display_name` and `handle` from the sign-up metadata. `handle` is unique and must match `^[a-z0-9_]{3,20}$`. Clients may update only `display_name`.
- `scan_codes`, `user_pets(user_id, pet_id, copies, …)` — PK `(user_id, pet_id)`
- `scans` — one row per draw; `pet_id`, `code_line` (station line for stats), `points` (leaderboard points that scan earned)
- `record_scan(...)`, `my_stats(p_user_id)` (scans, lines visited, points), `leaderboard(p_viewer, p_scope, p_limit)` — service role via Edge Functions
- `handle_available(p_handle)`, `touch_last_active()` — security-definer RPCs the app calls directly
- `follows(follower_id, followee_id, created_at)`: PK (follower, followee), with a check that you can't follow yourself. RLS on with no policies: written and read only through `social`.
- `user_summaries(p_viewer, p_ids)`, `search_users(p_viewer, p_prefix)` — service-role helpers for `social`

Migrations: `20251121220000_pet_id.sql` (collection keyed by `pet_id`), `20251122130000_profile_social.sql` (handle, timestamps, RPCs), `20251122140000_follows.sql` (follows + social helpers), `20251122150000_search_display_name.sql` (search by display name), `20251122170000_leaderboard.sql` (`scans.points` + backfill, points in `record_scan` / `my_stats`, `leaderboard` RPC). Skeleton ids: `{line}_{species}`.

Enums: `t_line` on `scan_codes` / `code_line`; roll metadata lives in `catalog.ts`, not Postgres enums for pets.

### Roster migration

- Catalog: `CATALOG` in `catalog.ts`, 35 entries keyed by `pet_id`. Look up with `getPet`.
- Pity: `roll_pity (user_id, since_epic_plus, since_legendary)` in `supabase/migrations/20251122100000_roll_pity.sql`. Not copied to Tiger.
- `record_scan` takes the pity the roll used (`p_expected_*`) and the next counters. A mismatch returns `pity_conflict` and writes nothing; `scan` re-rolls. The advisory lock is per `user_id`.
- Skeleton `pet_id`s are not rewritten. Wipe `user_pets` and `scans` if they still hold `{line}_{species}` rows.

### Planned (MVP — not in DB yet)

- Leaderboards: no new tables. `record_scan` stores `scans.points` (it gets the new and duplicate values from `scan` and decides new-pet and daily bonus itself); the `leaderboard` RPC sums them.

Tiger mirror: [tiger/README.md](tiger/README.md).

---

## Hackathon plan (~12 hours)

Order work so the **demo never breaks**.

| Priority | Work | Outcome |
| --- | --- | --- |
| **P0** | `supabase db push`, deploy `scan` + `player` + `social`, phone E2E | Judges can scan QR and see a pet |
| **P0** | Demo poster QRs + `is_demo` account | Smooth booth loop |
| **P1** | Expand `catalog.ts` + `roll.ts` + `roll.test.ts` (per-line table) | In the repo. Redeploy `scan` after `db push`. |
| **P1** | ~~DB `pet_id` migration~~ (see `20251121220000_pet_id.sql`) + redeploy functions | Collection keyed by `pet_id` |
| **P2** | Collection UI for 35 slots (filters, counts) | App matches target design |
| **P2** | Pity counters in DB + roll integration | In the repo (`roll_pity`). Needs `db push` + redeploy. |
| **P2** | ~~**Following** — `follows` migration + `social` Edge Function~~ (built; test on device) | Social demo for judges |
| **P2** | **Leaderboards** — RPC + UI (Collectors / Gold / Scans) | Arcade hook in pitch |
| **P3** | Tiger scan replication + Grafana dashboard (traffic, rush hour, drop-rate check) | MLH Tiger story |
| **P4** | Collection UI polish, full roster, pity | After social MVP works |

The 35-pet catalog and pity are in the repo. Following + leaderboards stay **in MVP scope**. Collection filters and art can trail that.

---

## Out of scope (for now)

Apple/Google sign-in, offline scan queue, app attestation (App Attest / Play Integrity) or vision verification, production art pipeline, in-station deployment without partners, **trading or gifting** pets, chat/DMs, seasonal leaderboard resets.

**In MVP scope (design only until built):** leaderboards (collectors / gold / scans). Pity and the 35-pet roster are implemented in the roll; collection layout can still trail.

---

## Demo checklist

- [ ] Migrations applied; `scan` / `player` deployed
- [ ] `.env.local` has Supabase URL + publishable key
- [ ] Physical device scan succeeds
- [ ] Demo account flagged `is_demo = true`
- [ ] Printed `btp:` codes for at least one code per line
