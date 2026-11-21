# BostonTPets: design

Collectible Boston pets. Ride the T, scan QR codes at stations, and collect creatures tied to each line and to the city.
Built for BostonHacks; the repo should stay playable after the event.

**Source of truth for game data (in code):** `supabase/functions/_shared/game/catalog.ts` and `roll.ts`.  
Until the expanded catalog ships, those files still implement the **skeleton** described under [Shipped today](#shipped-today-skeleton).

---

## Core loop

1. Sign up (display name, unique @username, email, password) or sign in.
2. Scan a BostonTPets QR code. Each code belongs to one station on one T line.
3. The **server** rolls a pet from that line's table (and pity rules when enabled), then the fare-gate animation reveals it.
4. The pet lands in your collection under a stable **`pet_id`**. Drawing the same `pet_id` again is a **duplicate**: copies go up and stars level (no second slot).

---

## Pet identity (`pet_id`)

Every collectible in the game is exactly one row in the catalog with a **globally unique** `pet_id` (stable slug, e.g. `mallard_duck`, `red_line_alewife`).

| Concept | Meaning |
| --- | --- |
| **`pet_id`** | The drawable collectible. **65** ids in the full roster; **20** in the skeleton. |
| **Collection slot** | At most one `user_pets` row per `(user_id, pet_id)`. |
| **Duplicate draw** | Same `pet_id` rolled again → increment `copies`, run gold merge; UI shows higher stars. |
| **`scans.id`** | Every scan is its own event (audit / history). Many scans can reference the same `pet_id`. |

Rules:

- Two different `pet_id`s are always different collectibles (e.g. base Alewife vs Red Line Alewife variant).
- **Shared commons** use one `pet_id` for all lines (e.g. `mallard_duck` whether you scanned on Red or Green).
- **Line-exclusive** creatures use one base `pet_id` per creature; only the **line variant** gets a second id (e.g. `lobster` vs `red_line_lobster`).
- Skeleton shorthand until the full catalog ships: `pet_id = "{line}_{species}"` (20 ids). Implemented in code as `petId(species, line)`.

Roll output always includes `pet_id`. `record_scan` upserts on `(user_id, pet_id)`.

---

## Shipped today (skeleton)

What is implemented in the app, database enums, and Edge Functions **right now**. Use this for the first end-to-end demo if the expanded catalog is not merged yet.

| Species | Rarity | Weight | Emoji |
| --- | --- | --- | --- |
| Duckling | common | 45% | 🐥 |
| Wild Turkey | common | 35% | 🦃 |
| Harbor Seal | rare | 15% | 🦭 |
| Lobster | legendary | 5% | 🦞 |

- **Collection size:** **20** unique `pet_id`s = `{line}_{species}` in `user_pets`.
- **Line roll:** 70% the scanned code's line; otherwise uniform among the other four lines.
- **Gold:** 1% on any roll; upgrades that slot permanently.
- **Pity:** none.
- **UI:** Collection shows four species cards with a dot per line; "X / 20 collected."

Demo accounts (`profiles.is_demo`, admin-only): boosted Lobster weight, 10% gold, **no scan cooldowns**.

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

With pity, expect roughly one Legendary every **~35** rolls on average (design target; validate in `roll.test.ts` after implementation).

Pity resets or decrements according to the tier that triggered the guarantee (document in `roll.ts` when built).

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

| Rule | Skeleton (now) | Target |
| --- | --- | --- |
| Table | Global species weights + random line | Roll only from **scanned line's** table |
| Line variant | N/A (line is always separate dimension) | 5% when creature is line-specific Rare+ |
| Gold | 1% | 1% |
| Pity | Off | Epic+ @ 10, Legendary @ 60 |
| RNG | `roll.ts` in `scan` Edge Function | Same; extend tests for new tables + pity |

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

Tabs: **Collection**, **Scan** (center), **Profile**. Social screens open from Profile; there is no separate Friends tab.

**MVP includes** following (search, follow, view other people's profiles and pets) and leaderboards. Following is built in the app against preview data; its backend is a follow-up (see [Data model](#data-model)). Leaderboards are spec only.

### Collection

- **Skeleton:** "X / 20", four species cards, dots per line (filled = collected, gold ring = gold), species detail route with all 5 line variants, stars, first-caught station and date.
- **Target:** "X / 65", grouped by **tier** and/or **line** (filter chips). Each card shows base + variant progress. Detail: stars, gold ring, first station, first caught date.
- **Refine (stretch):** search, "missing only", line-colored progress rings.

### Scan

Camera + reticle; unmount when tab blurs.

- Success → fare-gate reveal (a CharlieCard taps, the gate light shows the rarity color or gold, the gates open, the pet springs in; NEW! / TURNED GOLD! / LINE VARIANT! as needed).
- Cooldown → "Train already left 🚋 … next departure in Xh Ym".
- Invalid / inactive code / offline → message + Scan again.

### Profile

Avatar, display name, @username, last active and joined date, Pets / Following / Followers counts, an **Add friends** button, stat tiles (collected, gold, scans, lines visited), then a **Pets | History** toggle. Pets is a grid of owned pets; History is the scan history (own profile only). Link to **leaderboards** (or a compact top-3 teaser). Sign out at the bottom.

- **Pet sheet:** tapping any pet opens a bottom sheet with its level (copies, capped at ★5, extras counted), first caught date and gold status. It never shows the station, because the same sheet is used on other people's profiles.
- **Add friends:** search by username prefix (3+ characters, up to 20 results). Each result has a Follow button.
- **Someone's profile** (`/user/<handle>`): the same header with a Follow / Following button and their pet grid. No email, scan history or stations.
- **Following / Followers** (`/user/<handle>/follows`): two tabs of people, each with a Follow button.

### Following (MVP)

**Goals:** ride with classmates, compare collections, light social proof for the hackathon demo.

- **One-way follow**, no approval, like Instagram. The UI says "Following" and "Followers", shows a "Follows you" tag, and labels the button "Follow back" when they already follow you.
- **Profiles are public** to every signed-in user: display name, username, last active, joined date, follow counts, stats and pets. Email, scan history and stations are never shown to anyone else, since stations reveal where someone rides.
- **Usernames** are unique, lowercase, 3–20 characters of `a–z`, `0–9` and `_` (`src/lib/handle.ts`). They are chosen at sign-up, with a live availability check.
- **Last active** is set by the backend when the app opens or comes to the foreground (`touch_last_active`), not taken from Supabase's last sign-in, which goes stale because the app keeps you signed in.

**Not in MVP:** trading/gifting pets, blocking, DMs, activity feed.

**API shape:** Edge Function `social` (not written yet) taking `{ action, ...params }`; the actions are listed at the top of the social section in `src/lib/api.ts`. RLS stays read-own: other people's pets and profiles are served by `social` with the service role, without `first_station`.

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

Profiles, search and follows go through a third Edge Function, `social` (planned). Two small RPCs are called directly by the app: `handle_available` (works signed out, for the sign-up form) and `touch_last_active`.

---

## Data model

### Current (Supabase)

- `profiles(id, display_name, handle, is_demo, created_at, last_active_at)`: created by a trigger on sign-up, which copies `display_name` and `handle` from the sign-up metadata. `handle` is unique and must match `^[a-z0-9_]{3,20}$`. Clients may update only `display_name`.
- `scan_codes`, `user_pets(user_id, pet_id, copies, …)` — PK `(user_id, pet_id)`
- `scans` — one row per draw; `pet_id`, `code_line` (station line for stats)
- `record_scan(p_user_id, p_code_id, p_pet_id, p_is_gold, p_cooldown_hours)`, `my_stats(...)` — service role via Edge Functions
- `handle_available(p_handle)`, `touch_last_active()` — security-definer RPCs the app calls directly

Migrations: `20251121220000_pet_id.sql` (collection keyed by `pet_id`), `20251121230000_profile_social.sql` (handle, timestamps, RPCs). Skeleton ids: `{line}_{species}`.

Enums: `t_line` on `scan_codes` / `code_line`; roll metadata lives in `catalog.ts`, not Postgres enums for pets.

### Target migration (when implementing full roster)

- Catalog: array/map of **65** entries keyed by `pet_id` (tier, emoji, line-exclusive table). `parsePetId` in the app only covers skeleton slugs until then.
- Add **`roll_pity`** (or columns on `profiles`): `rolls_since_epic_plus`, `rolls_since_legendary` (names illustrative).
- **New migration only** — hand-authored migration file; keep Tiger `tiger/migrations/` in sync for analytics shapes if used.

### Planned (MVP — not in DB yet)

- `follows(follower_id, followee_id, created_at)`: PK (follower, followee), with a check that you can't follow yourself. Written only through `social`.
- Leaderboards: no new tables — aggregate `user_pets` / `scans` via RPC or views.

Tiger mirror: [tiger/README.md](tiger/README.md).

---

## Hackathon plan (~12 hours)

Order work so the **demo never breaks**.

| Priority | Work | Outcome |
| --- | --- | --- |
| **P0** | `supabase db push`, deploy `scan` + `player`, phone E2E on skeleton | Judges can scan QR and see a pet |
| **P0** | Demo poster QRs + `is_demo` account | Smooth booth loop |
| **P1** | Expand `catalog.ts` + `roll.ts` + `roll.test.ts` (per-line table, variants) | Backend matches target odds |
| **P1** | ~~DB `pet_id` migration~~ (see `20251121220000_pet_id.sql`) + redeploy functions | Collection keyed by `pet_id` |
| **P2** | Collection UI for 65 slots (filters, counts) | App matches target design |
| **P2** | Pity counters in DB + roll integration | Fairer legendary pacing |
| **P2** | **Following** — `follows` migration + `social` Edge Function (UI already built on preview data) | Social demo for judges |
| **P2** | **Leaderboards** — RPC + UI (Collectors / Gold / Scans) | Arcade hook in pitch |
| **P3** | Tiger scan replication + one chart | MLH Tiger story |
| **P4** | Collection UI polish, full roster, pity | After social MVP works |

If P1 slips, **ship the skeleton demo** and describe the full roster from this doc in the pitch. Following + leaderboards stay **in MVP scope** even if the 65-pet catalog slips.

---

## Out of scope (for now)

Apple/Google sign-in, offline scan queue, GPS or vision verification, production art pipeline, in-station deployment without partners, **trading or gifting** pets, chat/DMs, seasonal leaderboard resets.

**In MVP scope (design only until built):** following (search, follow, view pets; UI built, backend pending), leaderboards (collectors / gold / scans). **Also in scope for product:** pity, 65-slot roster — may trail the skeleton demo.

---

## Demo checklist

- [ ] Migrations applied; `scan` / `player` deployed
- [ ] `.env.local` has Supabase URL + publishable key
- [ ] Physical device scan succeeds
- [ ] Demo account flagged `is_demo = true`
- [ ] Printed `btp:` codes for at least one code per line
