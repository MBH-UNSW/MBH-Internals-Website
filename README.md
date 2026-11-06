# UBH PCB Design Review

Designers self-check a schematic / PCB against the checklist, send it to an electrical lead, and get the
review back in the same place. Built with React + Vite on the front end and **Supabase** (Postgres + login)
for the back end, deployed on Netlify.

## How the workflow works

```
Designer                                   Electrical lead
────────                                   ───────────────
New request (private draft)
Answer every item: ✓ Verified / N/A / ⚠ Issue
 (N/A and Issue need a comment)
Submit  ───────────────────────────────▶   Notified; request appears in "Waiting for a reviewer"
  (locked while with the lead)             Start review (claims it; designer is told)
                                           Mark ⚑ Needs change + comment, Accept all remaining
        ◀──────────── Request changes ──   (every flagged item needs a comment)
Notified; sees the lead's comments
Reply on each flagged item, fix, Resubmit ─▶ Round 2: only flagged items need re-checking
        ◀──────────────── Approve ───────  (all Critical items must be confirmed, no open issues)
Notified: approved
```

* Only the designer can edit their answers; only the reviewing lead can set lead answers. A lead can't review their own design.
* Rules are enforced **inside the database** (`supabase/schema.sql`), not just in the UI, so they can't be skipped from the browser.
* Designers see only their own requests. Leads see every request once it's submitted (never drafts).
* Notifications are in-app (🔔). Email notifications are not set up.

## Try it right now (no account needed)

```
npm install
npm run dev:demo
```

Opens the whole workflow against an in-browser database with three demo people (Alex and Jo are designers, Sam is a lead).
Data stays in your browser. This mode is never included in the production build.

## Go live (about 15 minutes)

1. **Create a Supabase project** (free tier is fine) at supabase.com.
2. In Supabase → **SQL Editor**, run these three files in order (paste, Run):
   1. `supabase/schema.sql`
   2. `supabase/seed_checklist.sql` (regenerate with `npm run db:seed` if you change checklist items)
   3. `supabase/setup.sql` – **edit the team code in it first.** New members need this code to sign up.
3. Supabase → **Project settings → API**: copy the *Project URL* and *anon public* key.
4. Netlify → Site settings → **Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
   (For local use, copy `.env.example` to `.env.local`.)
5. Open the site, **Create account** (with the team code), then in the Supabase SQL editor make yourself the first lead:
   `update profiles set role = 'lead' where email = 'you@example.com';`
   After that, leads can promote other leads from the **Team** page.
6. Optional: Supabase → Authentication → Providers → Email: turn "Confirm email" off if you don't want sign-up confirmation emails.

The anon key is meant to be public. What people can do is limited by the database's row-level security and the workflow functions.

## Changing the checklist

Edit `src/data/checklist.js`. **Add new items at the end of a list** (IDs come from row order). Then run `npm run db:seed`
and paste `supabase/seed_checklist.sql` into the SQL editor. Existing reviews keep their answers; new items
show up as unanswered in reviews started afterwards (and in drafts, which must be answered before submitting).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local site against your real Supabase (needs `.env.local`) |
| `npm run dev:demo` | Local site with the in-browser demo database |
| `npm run test:db` | Runs `schema.sql` in an in-process Postgres and tests the whole workflow and its security rules |
| `npm run db:seed` | Regenerates `supabase/seed_checklist.sql` from the checklist |
| `npm run build` | Production build (Netlify runs this) |

## Not medical-device verification

This is an educational engineering review aid. A completed checklist is not evidence of compliance with
IEC 60601-1, IEC 60601-1-2, ISO 14971 or any other medical-device standard.
