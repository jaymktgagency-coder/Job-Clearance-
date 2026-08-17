# Vouch

A two-sided hiring marketplace built on warm introductions.

- **Seekers** create a profile, upload a resume, browse roles, and request an
  intro to a specific job. Free, forever.
- **Insiders** are verified current employees. They see intro requests for roles
  at their own company, review the seeker, and either write a short vouch or
  decline.
- **Employers** post roles and only ever see candidates who already have a vouch
  attached, ranked by an advisory AI fit score.

**New here? Read [SETUP.md](./SETUP.md).** It walks through every account and key
from scratch, then how to run the site on your laptop.

---

## Ground rules baked into this product

These are requirements, not preferences. Any future change must keep them true.

1. **The AI score is advisory only.** It never auto-rejects anyone. The written
   reasoning is always shown next to the number, and a human always makes the
   actual decision.
2. **Seekers are told, visibly, that AI helps rank their application.**
3. **Job seekers are never charged.** Seeker features are free forever.
4. **No scraping.** No LinkedIn, no external connection graphs. Insiders
   self-declare their employer and verify by work email only.
5. **Resumes are personal data.** Users can delete their account and all of
   their data.

---

## Tech stack

| Piece | What it's for |
|---|---|
| Next.js 16 (App Router) + TypeScript | The website itself, pages and server code |
| Tailwind CSS v4 + shadcn/ui | Styling and ready-made UI components |
| Supabase | Database (Postgres), logins, resume file storage |
| Anthropic API | Resume parsing, candidate fit scoring |
| Resend | Transactional email (insider verification codes) |
| Stripe Connect | Payments — **stubbed out, not implemented in v1** |
| Vercel | Hosting |

## Running it locally

```bash
npm install
cp .env.example .env.local   # then paste your keys in — see SETUP.md
npm run dev
```

- <http://localhost:3000> — the site
- <http://localhost:3000/setup> — checks your keys and Supabase connection

## Where things live

```
src/
  app/                 Pages. A folder here = a URL.
    page.tsx           The home page (/)
    setup/page.tsx     The setup health-check page (/setup)
    layout.tsx         Wrapper around every page: fonts, tab title
  components/ui/       shadcn/ui building blocks (button, card, input...)
  lib/
    env.ts             Every environment variable, in one list
    supabase/client.ts Supabase connection for browser code
    supabase/server.ts Supabase connection for server code (+ admin version)
    supabase/health.ts The connection test used by /setup
  proxy.ts             Runs before every request; keeps logins from expiring
```

## Build progress

- [x] **Step 1** — Project scaffold, Supabase connection, environment setup
- [ ] Step 2 — Database schema + seed script with fake data
- [ ] Step 3 — Auth + onboarding for all three roles
- [ ] Step 4 — Insider verification by work email + 6-digit code
- [ ] Step 5 — Seeker flow: profile, resume upload, browse jobs, request intro
- [ ] Step 6 — Insider flow: request inbox, write vouch or decline (max 5 open
      intro requests per seeker)
- [ ] Step 7 — Employer flow: post a job, view vouched candidates, update status
- [ ] Step 8 — AI layer: resume parsing + fit scoring with written reasoning
