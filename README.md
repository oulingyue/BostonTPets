# BostonTPets

BostonHacks project: gacha pets you collect by scanning QR codes at T stations.
4 Boston animals (Duckling, Wild Turkey, Harbor Seal, Lobster) × 5 T line colors = 20 pets.

See [DESIGN.md](DESIGN.md) for the agreed game design.

## Stack

- **App:** Expo SDK 58 + Expo Router + TypeScript (`src/`)
- **Backend:** Supabase Auth + an Edge Function `scan` that rolls pets server-side (`supabase/functions/`)
- **Shared game logic:** `supabase/functions/_shared/game/` (catalog, odds, roll). The app imports it as `@game/*`.

## Run the app

```sh
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npx expo start               # open in Expo Go on your phone
```

The camera works only on a physical device.

> The database schema (tables, RLS, `record_scan`) is coming in a follow-up PR. Until then, sign-in works,
> but scanning and the collection screens will error because their tables don't exist yet.

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
