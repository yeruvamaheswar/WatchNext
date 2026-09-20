<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# WatchNext agent rules

Before changing code in this repo:

1. Read [`docs/ENGINEERING_PRINCIPLES.md`](docs/ENGINEERING_PRINCIPLES.md) and follow it (requirements → delete → simplify → speed → automate).
2. Never expose, commit, or print secrets or PII (`.env*`, API keys, tokens, service-role secrets, passwords, medical/family data). Keep secrets in Vercel env / local `.env.local` only. `NEXT_PUBLIC_*` is for intentional public config only.
3. Prefer the smallest focused change. No drive-by refactors, filler abstractions, or unsolicited docs.
4. Keep [`docs/CODE_FLOW.md`](docs/CODE_FLOW.md) current when routes, hooks, `lib/` call graphs, or flow-owning components change (diagrams + “what it does” rows).

Teammates: treat `docs/ENGINEERING_PRINCIPLES.md` as the authority. Do not load private persona hubs, family pages, or identity biography for this project.

Optional / Uma-only (not required for teammates; do not scrape a private persona hub): Engineering Persona in Notion — https://app.notion.com/p/3c609576726d81458959fbe1e06845ff
