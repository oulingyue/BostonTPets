# BostonTPets: design

Collectible Boston pets. Ride the T, scan QR codes at stations, and collect creatures tied to each line and to the city.
Built for BostonHacks; the repo should stay playable after the event.

**Source of truth for game data (in code):** `supabase/functions/_shared/game/catalog.ts` and `roll.ts`.  
Those files implement the full roster and pity rules below. Collection and art should read `getPet(petId)`, `CATALOG`, and `TOTAL_PETS`.

---

## Core loop

1. Sign in (email + password).
2. Scan a BostonTPets QR code. Each code belongs to one station on one T line.
3. The **server** rolls a pet from that line's table (and pity rules when enabled), then the fare-gate animation reveals it.
4. The pet lands in your collection under a stable **`pet_id`**. Drawing the same `pet_id` again is a **duplicate**: copies go up and stars level (no second slot).

---

## Pet identity (`pet_id`)

Every collectible in the game is exactly one row in the catalog with a **globally unique** `pet_id` (stable slug, e.g. `mallard_duck`, `red_line_alewife`).

| Concept | Meaning |
| --- | --- |
| **`pet_id`** | The drawable collectible. **65** ids. |
| **Collection slot** | At most one `user_pets` row per `(user_id, pet_id)`. |
| **Duplicate draw** | Same `pet_id` rolled again → increment `copies`, run gold merge; UI shows higher stars. |
| **`scans.id`** | Every scan is its own event (audit / history). Many scans can reference the same `pet_id`. |

Rules:

- Two different `pet_id`s are always different collectibles (e.g. base Alewife vs Red Line Alewife variant).
- **Shared commons** use one `pet_id` for all lines (e.g. `mallard_duck` whether you scanned on Red or Green).
- **Line-exclusive** creatures use one base `pet_id` per creature; only the **line variant** gets a second id (e.g. `lobster` vs `red_line_lobster`).
- Ids in code: shared commons use the base slug (`mallard_duck`). Line-exclusives use the base slug (`lobster`, `alewife`). The line variant is `{line}_line_{baseId}` (`red_line_lobster`, `red_line_alewife`).

Roll output always includes `pet_id`. `record_scan` upserts on `(user_id, pet_id)`.

---

## Shipped today

`catalog.ts`, `roll.ts`, and `record_scan` implement the [loot table](#loot-table) and [pity](#pity-target) below.

- **Collection size:** **65** `pet_id`s (5 shared commons + 30 line-exclusives + 30 line variants).
- **Line roll:** the scanned code's line only.
- **Line variant:** 5% when the creature is line-specific Rare, Epic, or Legendary.
- **Gold:** 1% on any roll; upgrades that slot permanently.
- **Pity:** `roll_pity.since_epic_plus` / `since_legendary`, updated inside `record_scan` (migration `20251122100000_roll_pity.sql`). See [Pity](#pity-target).
- **UI:** Collection is a temporary rarity-grouped list (`X / 65`) so the new ids render. Filters and layout belong to the collection teammate. Art is still the catalog emoji; sprites can key off `petId`.
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

### Line variants

Line-specific creatures (Rare, Epic, Legendary only) have a **5%** chance to drop in **that line's color** (visual + collection slot). Commons are never line-colored.

Examples:

- Red Line Alewife (variant): 10% × 5% = **0.5%**
- Red Line Lobster (variant): 2% × 5% = **0.1%** (~1 in 1,000) — rarest single outcome
- Overall, **~2%** of rolls are a line variant (40% of outcomes are line-specific × 5%).

**Collection size:** **65** unique `pet_id`s — 35 base + 30 line-variant ids (one variant id per line-specific Rare/Epic/Legendary on each line).

Display names come from catalog metadata per `pet_id` (e.g. *Alewife* vs *Red Line Alewife*).

### Pity (target)

Track per-user counters on the server (not client):

- **Epic+:** guaranteed within **10** rolls without Epic or better.
- **Legendary:** guaranteed by roll **60** without a Legendary.

Pity resets from the **base** rarity (a line variant or gold does not change it). Documented in `roll.ts`:

- Legendary (natural or pity) → both counters `0`.
- Epic → `sinceEpicPlus = 0`, `sinceLegendary += 1`.
- Rare or common → both counters `+= 1`.
- If both guarantees are due, Legendary wins.

Epic pity draws that line's two epics and its legendary at **4:4:2**, so some guaranteed Epic+ rolls are legendaries. With both guarantees, expect about one Legendary every **~28** rolls (`roll.test.ts`). A flat 2% capped at 60, ignoring those extra legendaries, would be ~35.

### Gold (unchanged intent)

**1%** on any roll upgrades the **collection slot** that received the pet (base or line variant). "All gold" remains an optional completion goal.

Demo accounts: higher gold rate and no cooldowns; pity may be disabled or relaxed for booth demos (config in `DEMO_ODDS`).

### Local flavor (pitch notes)

- **Red:** Alewife station; MIT at Kendall/MIT.
- **Green:** snapping turtle / slow Green Line; BU, BC, swan boats, Frog Pond.
- **Orange:** Northeastern and Wentworth at Ruggles; Haymarket rat.
- **Blue:** Aquarium, harbor wildlife, Revere Beach plovers.
- **Silver:** Logan snowy owls; Seaport cod.

### Art

Placeholder: emoji (or a single generic glyph per tier) on a circle tinted with line color when `is_line_variant`.  
Later: one sprite per creature + programmatic line tint for variants.

---

## Roll rules (server-side only)

| Rule | Implemented |
| --- | --- |
| Table | Roll only from **scanned line's** table |
| Line variant | 5% when creature is line-specific Rare+ |
| Gold | 1% (10% on demo accounts) |
| Pity | Epic+ @ 10, Legendary @ 60 (off for demo accounts) |
| RNG | `roll.ts` in the `scan` Edge Function; clients never choose the outcome |

Clients never choose outcomes. `scan` calls `record_scan` after a successful roll.

---

## Duplicates and levels

- First time you roll a `pet_id`: **new** slot, `copies = 1`, store `first_station` / `first_caught_at`.
- Same `pet_id` again: **duplicate** — `copies += 1`, stars = `min(copies, 5)`; extras shown as ★★★★★ +N. Cosmetic only.
- Gold on a duplicate still upgrades that slot (`is_gold` sticks).

Never create a second collection row for the same `pet_id`.

---

## Scan limits and code integrity

- **Per-code cooldown:** one scan per user per code every **24 h** (skipped when `profiles.is_demo`).
- **Payload:** `btp:<32 hex>` — opaque ID; station is resolved server-side from `scan_codes`.
- **Transfer stations:** one code per line (e.g. Park Street Red vs Green).
- **Placement:** hackathon poster; later partners near stations. In-station stickers need MBTA permission.
- **Connectivity:** online only; show "No signal — try again above ground" when the request fails.

---

## Screens

Tabs: **Collection**, **Scan** (center), **Friends**, **Profile** (MVP — Friends tab can ship after core scan loop is stable).

**MVP includes** friends (add + view collections) and leaderboards. Not implemented in the repo yet; spec below.

### Collection

- **Skeleton:** "X / 20", four species cards, dots per line, species detail route.
- **Target:** "X / 65", grouped by **tier** and/or **line** (filter chips). Each card shows base + variant progress. Detail: stars, gold ring, first station, first caught date.
- **Refine (stretch):** search, "missing only", line-colored progress rings.

### Scan

Camera + reticle; unmount when tab blurs.

- Success → fare-gate reveal (rarity color or gold; NEW! / TURNED GOLD! / LINE VARIANT! as needed).
- Cooldown → "Train already left 🚋 … next departure in Xh Ym".
- Invalid / offline → message + Scan again.

### Profile

Display name, email, stat tiles (collected, gold, scans, lines visited), scan history, sign out. Link to **leaderboards** (or show a compact top-3 teaser).

### Friends (MVP)

**Goals:** ride with classmates, compare collections, light social proof for the hackathon demo.

**Add a friend**

- By **display name** search (must match exactly one profile), or by **`friend_code`** (short unique code on `profiles`, generated at sign-up).
- Request → **pending** until the other user accepts (symmetric friendship only; no one-way follow in MVP).
- Cap **50** friends per user for MVP (abuse guard).

**Friend list**

- Name, `X / TOTAL_PETS` collected, gold count, last active (optional: relative time of last scan).
- Tap → **friend profile**: read-only collection (same layout as own Collection, but no scan). Show their pets with stars/gold; hide email and scan history details unless we later add a privacy toggle (MVP: **no** scan history on friend view).

**Not in MVP:** trading/gifting pets, blocking, DMs, activity feed.

**API shape (planned)**

- Extend `player` or add Edge Function `social` with `resource`: `friend_search`, `friend_request`, `friend_accept`, `friend_decline`, `friends_list`, `friend_pets` (target `user_id` must be an accepted friend).
- RLS: users never read arbitrary `user_pets`; only self or via service role after friendship check.

### Leaderboards (MVP)

**Goals:** arcade-style ranking for the pitch — “who’s filling the dex fastest?”

**Boards** (all-time for hackathon MVP; no season reset required):

| Board | Rank by |
| --- | --- |
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

---

## Data model

### Current (Supabase)

- `profiles(id, display_name, is_demo)`
- `scan_codes`, `user_pets(user_id, pet_id, copies, …)` — PK `(user_id, pet_id)`
- `scans` — one row per draw; `pet_id`, `code_line` (station line for stats)
- `record_scan(p_user_id, p_code_id, p_pet_id, p_is_gold, p_cooldown_hours)`, `my_stats(...)` — service role via Edge Functions

Migration: `supabase/migrations/20251121220000_pet_id.sql`. Skeleton ids: `{line}_{species}`.

Enums: `t_line` on `scan_codes` / `code_line`; roll metadata lives in `catalog.ts`, not Postgres enums for pets.

### Roster migration

- Catalog: `CATALOG` in `catalog.ts`, 65 entries keyed by `pet_id`. Look up with `getPet`.
- Pity: `roll_pity (user_id, since_epic_plus, since_legendary)` in `supabase/migrations/20251122100000_roll_pity.sql`. Not copied to Tiger.
- `record_scan` takes the pity the roll used (`p_expected_*`) and the next counters. A mismatch returns `pity_conflict` and writes nothing; `scan` re-rolls. The advisory lock is per `user_id`.
- Skeleton `pet_id`s are not rewritten. Wipe `user_pets` and `scans` if they still hold `{line}_{species}` rows.

### Planned (MVP — not in DB yet)

- `profiles.friend_code text UNIQUE NOT NULL` (e.g. 8-char alphanumeric, generated on insert).
- `friendships (id, user_a, user_b, status, created_at)` with `user_a < user_b` canonical pair, `status` in `pending`, `accepted`, `declined`; unique on `(user_a, user_b)`.
- Leaderboards: no new tables — aggregate `user_pets` / `scans` via RPC or views.

Tiger mirror: [tiger/README.md](tiger/README.md).

---

## Hackathon plan (~12 hours)

Order work so the **demo never breaks**.

| Priority | Work | Outcome |
| --- | --- | --- |
| **P0** | `supabase db push`, deploy `scan` + `player`, phone E2E | Judges can scan QR and see a pet |
| **P0** | Demo poster QRs + `is_demo` account | Smooth booth loop |
| **P1** | Expand `catalog.ts` + `roll.ts` + `roll.test.ts` (per-line table, variants) | In the repo. Redeploy `scan` after `db push`. |
| **P1** | ~~DB `pet_id` migration~~ (see `20251121220000_pet_id.sql`) + redeploy functions | Collection keyed by `pet_id` |
| **P2** | Collection UI for 65 slots (filters, counts) | App matches target design |
| **P2** | Pity counters in DB + roll integration | In the repo (`roll_pity`). Needs `db push` + redeploy. |
| **P2** | **Friends** — migration + `social`/`player` + Friends tab + friend collection view | Social demo for judges |
| **P2** | **Leaderboards** — RPC + UI (Collectors / Gold / Scans) | Arcade hook in pitch |
| **P3** | Tiger scan replication + one chart | MLH Tiger story |
| **P4** | Collection UI polish, full roster, pity | After social MVP works |

The 65-pet catalog and pity are in the repo. Friends + leaderboards stay **in MVP scope**. Collection filters and art can trail that.

---

## Out of scope (for now)

Apple/Google sign-in, offline scan queue, GPS or vision verification, production art pipeline, in-station deployment without partners, **trading or gifting** pets, chat/DMs, one-way follows, seasonal leaderboard resets.

**In MVP scope (design only until built):** friends (add, accept, view pets), leaderboards (collectors / gold / scans). Pity and the 65-pet roster are implemented in the roll; collection layout can still trail.

---

## Demo checklist

- [ ] Migrations applied; `scan` / `player` deployed
- [ ] `.env.local` has Supabase URL + publishable key
- [ ] Physical device scan succeeds
- [ ] Demo account flagged `is_demo = true`
- [ ] Printed `btp:` codes for at least one code per line