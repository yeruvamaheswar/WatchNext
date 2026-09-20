# WatchNext engineering principles

Team-safe rules for humans and agents working in this repo. Apply them **in order**. Prefer evidence over speculation and the smallest change that solves the real problem.

## 1. Requirements

Challenge every important requirement before building.

- What problem does this actually solve?
- Who owns it, and what evidence supports it?
- Is it a real constraint or an inherited assumption?
- What happens if we remove it?

Do not keep a requirement only because it came from a prior design, “best practice,” or an existing file.

## 2. Delete

After questioning requirements, remove what is unnecessary — before optimizing.

Look for removable features, layers, abstractions, dependencies, config, duplicated logic, speculative edge cases, and “just in case” code.

Prefer the minimum system that solves the problem. Deletion is disciplined cost control, not recklessness.

## 3. Simplify

Only simplify and optimize what remains after deletion.

Prefer fewer moving parts, smaller APIs, direct control flow, and conventional solutions when they are enough. Optimize the whole product, not a local component that makes the system worse.

## 4. Speed

Once the direction is correct, shorten the loop: idea → implementation → test → feedback → correction.

Ship small, reversible changes. When uncertainty is high, run the cheapest experiment that answers the question. Do not accelerate work aimed the wrong way.

## 5. Automate

Automate last — only after the process is necessary, understood, simplified, and stable.

Never automate a broken, unclear, or deletable workflow. Automation should multiply a good process, not freeze a bad one.

---

## Evidence and decisions

- Prefer measurement, logs, prototypes, and production behavior over debate and intuition.
- State assumptions and unknowns clearly.
- Prefer the option with fewer parts, clearer ownership, faster feedback, and easier reversal.
- Fix root causes when practical; avoid permanent workaround piles.
- Do not build speculative architecture for requirements that may never exist.

## Anti-slop

- No filler abstractions, drive-by refactors, or unsolicited docs.
- Match existing style, structure, and naming in this repo.
- No gold-plating, premature microservices, or “architecture astronautics.”
- Do not expand scope beyond the requested change.
- Do not create commits or push remotes unless the user asks.

## Secrets and PII

- Never commit or print `.env`, API keys, tokens, service-role secrets, passwords, OTPs, or private medical/family data.
- Keep server secrets in Vercel project env / local `.env.local` only — never in the client bundle or git.
- `NEXT_PUBLIC_*` is for intentional public config only (e.g. Supabase URL and anon/publishable key). Do not put service-role or provider secret keys there.
- Do not paste real key values into README, issues, chat, or sample docs — names only.
- Do not document or commit `VERCEL_OIDC_TOKEN` or similar machine tokens from local env files.

## Communication

Be direct, concise, and specific. Lead with the answer. Explain the real problem, assumptions, what can be deleted, the simplest viable design, major tradeoffs, how it will be tested, and what success looks like.
