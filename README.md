# WatchNext

Local-only Next.js PWA: swipe three onboarding questions, then pick something to watch on **Home** or talk it out in a ChatGPT-style **Room**. Catalog lives in local Supabase Postgres + pgvector (TMDB slice). No Vercel deploy.

## What works without API keys

The app **boots** with empty keys. You can:

- Complete 3-question swipe onboarding (static popular titles + vibe cards)
- Use Home / Room tabs and the hamburger (Preferences, User, Account)
- Stay on a guest session

Clear errors appear when a key is missing:

| Feature | Needs |
| --- | --- |
| `npm run ingest` | `TMDB_API_KEY`, `OPENAI_API_KEY`, local Supabase |
| Home “What should I watch?” | `OPENAI_API_KEY`, local Supabase with ingested embeddings |
| Room STT / extract / TTS | `OPENAI_API_KEY` |
| Room / Home suggest | `OPENAI_API_KEY` + ingested catalog |

Copy `.env.example` to `.env.local` and fill secrets there (never commit `.env.local`).

## Run locally

### 1. App

```bash
cp .env.example .env.local   # OPENAI_API_KEY / TMDB_API_KEY, or GitHub aliases OPENAI_CONVERSTION_WATCHNEXT / TMDB_API
npm install
npm run dev                  # http://127.0.0.1:3000  (binds 0.0.0.0 for LAN)
```

On a phone or another PC, open `http://<your-machine-ip>:3000` (Next prints a Network URL). LAN IPv4 hosts are allowed automatically. For a tunnel hostname, set `ALLOWED_DEV_ORIGIN`.

Safari may require HTTPS for the mic; use a local HTTPS proxy if `getUserMedia` is blocked on HTTP.

Add to Home Screen for standalone PWA chrome (`display: standalone`, purple theme, Apple splash + icons).

### 2. Local Supabase (Docker)

Docker must be running. Nested Docker / overlayfs environments can fail image extract (`whiteout file ... operation not permitted`); run `npx supabase start` on a normal Docker Desktop/Linux host instead.

```bash
npx supabase start
```

Copy the printed `API URL`, `anon key`, and `service_role` key into `.env.local` if they differ from the demo values in `.env.example`.

Migrations apply on first start. To re-apply:

```bash
npx supabase db reset
# or
npx supabase migration up
```

Studio: http://127.0.0.1:54323

Stop:

```bash
npx supabase stop
```

### 3. Ingest TMDB + embeddings

```bash
npm run ingest
# optional: npm run ingest -- --pages 5 --quick
```

`--quick` skips per-title keywords/cast calls. Default is 10 TMDB pages each of movies and TV (~400 titles).

## Voice pipeline (Room)

Explicit, not Realtime API:

1. **VAD** — energy-based speech vs silence on this device’s mic  
2. **STT** — `/api/transcribe` (Whisper / `gpt-4o-transcribe`)  
3. **Extract** — `/api/extract` titles, people, moods, constraints, watch-intent  
4. **Embed + search** — blend query with onboarding taste, `match_titles` RPC  
5. **Suggest** — LLM picks 1–3 titles  
6. **TTS + tiles** — `/api/tts` while poster cards slide up  

Suggestions run on pause **and** watch-intent (or the **Suggest** button). Bottom tabs hide during an active session.

## Scripts

| Script | What |
| --- | --- |
| `npm run dev` | Next.js on `0.0.0.0:3000` |
| `npm run build` / `npm start` | Production local server |
| `npm run icons` | Generate favicon, PWA, Apple, and OG images |
| `npm run ingest` | TMDB upsert + OpenAI embeddings |
| `npx supabase start` | Local Postgres, Auth, Studio |
| `npx supabase db reset` | Recreate DB from `supabase/migrations` |

## Stack

Next.js App Router, Tailwind, shadcn/ui (dark purple), local Supabase (Auth, pgvector, RLS), TMDB, OpenAI.
