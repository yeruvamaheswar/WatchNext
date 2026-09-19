# WatchNext

Mood + genre in, a short ranked list out — with a one-line why for each pick.

## Run locally

```bash
npm install
npm run dev
```

Dev server binds to [http://127.0.0.1:43127](http://127.0.0.1:43127).

## What’s in this slice

- `data/catalog.json` — ~50 movies/TV titles with genres, moods, and overviews
- `lib/recommend.ts` — scores 1–3 picks (friendly empty/invalid fallback; never crashes)
- `app/page.tsx` — homepage form: mood, genre, optional favorites → ranked result cards

Provider switch (for a future TMDB MCP / API path without rewriting the page):

```bash
# default — local catalog
RECOMMEND_PROVIDER=catalog

# later, once TMDB MCP / token is wired
RECOMMEND_PROVIDER=tmdb
```

No auth, no Supabase, no streaming deep-links in this slice.
