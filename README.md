# WatchNext

Next.js PWA that learns a quick taste profile, then picks something to watch. Use **Home** for a one-tap recommendation, or **Room** to talk it out — solo live voice, typed search, or a group of people around one phone.

The catalog is TMDB titles plus OpenAI embeddings in Supabase Postgres (pgvector). Guests get an anonymous Auth session when that provider is enabled; lists also survive locally if Auth is down.

The app runs on your machine, a VM, Docker, or a **private** Vercel production deploy. Secrets stay in server env (`.env.local` locally, Vercel project env in production) — never in git or the client bundle beyond intentional `NEXT_PUBLIC_*` config.

## Surfaces

| Route | What it does |
| --- | --- |
| `/` | Splash, then `/onboarding` or `/home` |
| `/onboarding` | Three swipe decks: movies, TV, vibes |
| `/home` | “What should I watch?” orb + poster tiles |
| `/room` | Live Realtime session, text search, or Group mode |
| `/preferences` | Liked / dismissed titles, vibes, watchlist, seen, redo onboarding |
| `/user` | Display name |
| `/account` | Email/password sign-in, sign-up, guest, sign-out |

The header logo opens Preferences, User, and Account. Bottom tabs are Home and Room. Add to Home Screen for standalone chrome (purple theme, Apple splash + icons).

## What works without API keys

The app **boots** with empty keys. You can finish onboarding on fallback cards, move around the shell, and keep a local guest session. A health banner explains what is missing.

| Feature | Needs |
| --- | --- |
| `npm run ingest` | `TMDB_API_KEY`, `OPENAI_API_KEY`, Supabase service role |
| Home / Room recommendations | `OPENAI_API_KEY`, ingested catalog |
| Room live session | `OPENAI_API_KEY` (Realtime) |
| Room Group mode | `OPENAI_API_KEY` (diarize + recommend) |
| Posters / extra catalog metadata | `TMDB_API_KEY` |
| Guest sync across devices | Hosted or local Supabase with **Anonymous** sign-ins enabled |

Copy `.env.example` to `.env.local` and fill secrets there. Never commit `.env.local` or paste real key values into docs/chat — **names only**.

Canonical env names win when a GitHub alias is also set: `OPENAI_API_KEY` / `OPENAI_CONVERSTION_WATCHNEXT`, `TMDB_API_KEY` / `TMDB_API`. Supabase accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`.

Do not put service-role or provider secret keys in `NEXT_PUBLIC_*`. Do not commit machine tokens such as `VERCEL_OIDC_TOKEN` if they appear in a local env file.

## Private production (Vercel)

Linked project: `watchnext` (team `silent-maverick07`). Production alias: `https://watchnext-beta.vercel.app`.

1. Upload the same key **names** from `.env.local` into Vercel Production / Preview / Development (CLI `vercel env add` or dashboard). Use hosted Supabase — never `127.0.0.1` on Vercel.
2. `npx vercel deploy --prod --yes`
3. Enable **Deployment Protection** (Project → Settings → Deployment Protection → Vercel Authentication) so the URL is not public. Owners can probe with `npx vercel curl <url>`.
4. On iPhone: open the HTTPS URL → sign in with Vercel when prompted → Safari Share → **Add to Home Screen**. Mic needs real HTTPS (PWA standalone works after add).

Out of scope on Vercel: catalog ingest — run `npm run ingest` locally against hosted Supabase. Connecting GitHub for auto-deploys is optional (`vercel git connect`).

Agent/engineering rules for this repo: [`docs/ENGINEERING_PRINCIPLES.md`](docs/ENGINEERING_PRINCIPLES.md) and [`AGENTS.md`](AGENTS.md). Code journeys and per-file map: [`docs/CODE_FLOW.md`](docs/CODE_FLOW.md).

## Run the app

```bash
cp .env.example .env.local
npm install
npm run dev                  # http://127.0.0.1:3000  (binds 0.0.0.0 for LAN)
```

On a phone or another PC, open `http://<your-machine-ip>:3000`. LAN IPv4 hosts are allowed automatically. For a tunnel hostname in `next dev`, set `ALLOWED_DEV_ORIGIN`.

Safari often blocks the mic on plain HTTP. Put a reverse proxy or named tunnel in front so the phone sees trusted HTTPS.

### Docker

The image is HTTP only (`next start` standalone). Compose maps `WATCHNEXT_PORT` (default `43300`) so it does not steal host port `3000`. Bind defaults to loopback so a host tunnel/proxy is the public door.

```bash
docker compose --env-file .env.local up -d --build
```

Useful env (all optional, all stay in `.env.local`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `WATCHNEXT_PORT` | `43300` | Host port |
| `WATCHNEXT_BIND` | `127.0.0.1` | Use `0.0.0.0` only if you want LAN HTTP without a proxy |
| `WATCHNEXT_ENV_FILE` | `.env.local` | Compose env file |
| `NEXT_PUBLIC_APP_URL` | request host | Public HTTPS origin for icons / Open Graph |

Rebuild after changing `NEXT_PUBLIC_*` values; they are baked in at image build time.

## Supabase

Use **either** local Docker **or** a hosted project. Do not leave both URL/key pairs uncommented in `.env.local`.

### Local

```bash
npx supabase start
```

Copy the printed API URL, anon key, and service_role key into `.env.local` if they differ from `.env.example`. Studio is http://127.0.0.1:54323.

```bash
npx supabase db reset          # recreate from supabase/migrations
npx supabase stop
```

`supabase/config.toml` already has `enable_anonymous_sign_ins = true` for local Auth.

### Hosted

Point `NEXT_PUBLIC_SUPABASE_URL` and a publishable/anon key at the project, plus a service role / secret key for ingest. Then enable **Anonymous** under Authentication → Providers. If that toggle is off, opening the app POSTs `/auth/v1/signup` and the browser logs `422 Unprocessable Content` (`anonymous_provider_disabled`). Apply the same migrations as local.

## Ingest TMDB + embeddings

```bash
npm run ingest
# demo slice: npm run ingest -- --limit 10
# optional: npm run ingest -- --pages 5 --quick
```

`--limit N` upserts and embeds N titles (mixed movies + TV). `--quick` skips per-title keywords/cast. Default is 10 TMDB pages each of movies and TV (~400 titles). Embedding text is title + overview + tags.

## Room voice

**Live (default).** One-on-one OpenAI Realtime over WebRTC. Captions stream while you talk; the host can suggest mid-conversation. You can also type a search without starting the mic.

**Group mode.** Toggle next to the search field. One phone records everyone nearby (noise-hardened mic + energy VAD). After ~6s of silence or a tap on Suggest, audio is diarized (`gpt-4o-transcribe-diarize`) and the catalog is searched for a group compromise.

Batch helpers (`/api/transcribe`, `/api/extract`, `/api/tts`) still exist. Live Room uses Realtime; Group uses `/api/transcribe/diarize` + `/api/group/recommend`.

## Icons

`npm run icons` regenerates favicon, PWA, Apple touch, splash, and social images. Apple home-screen marks are drawn larger than the generic PWA icons so they fill the rounded square. iOS rejects apple-touch-icons with an alpha channel; those files stay RGB.

After changing icons, rebuild the Docker image (or restart `next dev`) and, on a phone, remove and re-add the Home Screen shortcut so iOS drops the cached icon.

## Scripts

| Script | What |
| --- | --- |
| `npm run dev` | Next.js on `0.0.0.0:3000` |
| `npm run dev:https` | Experimental Next HTTPS (dev only; flaky — prefer a host tunnel) |
| `npm run build` / `npm start` | Production local server |
| `docker compose --env-file .env.local up -d --build` | Production container on `WATCHNEXT_PORT` |
| `npm run icons` | Generate favicon, PWA, Apple, and OG images |
| `npm run ingest` | TMDB upsert + OpenAI embeddings |
| `npx supabase start` | Local Postgres, Auth, Studio |
| `npx supabase db reset` | Recreate DB from `supabase/migrations` |

## Stack

Next.js App Router (standalone output), Tailwind, shadcn/ui (dark purple), Supabase (Auth, pgvector, RLS), TMDB, OpenAI (chat, embeddings, Realtime, transcribe, TTS).
