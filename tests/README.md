# Browser tests

**You don't need to run these.** They drive a real browser through the parts
of Vouch a person actually clicks, so a change to sign-up or the dashboards
can be checked without doing it by hand every time.

| File | What it covers |
|---|---|
| `auth-flows.mjs` | Signed-out visitors are redirected; all three roles sign in and see the right dashboard; verified, invited, and unverified vouchers each see the right status |
| `invite-flow.mjs` | The whole employer-invite path: creating a link, what the invited person sees, finishing onboarding as a *verified* voucher, the invitation being marked used, and the link refusing to work twice |
| `onboarding-paths.mjs` | Seeker, employer, and self-serve voucher onboarding, including a personal email address being refused with a pointer to the invite path |
| `seeker-flow.mjs` | The seeker's whole journey: profile editing, a real resume upload into the private bucket, checking the file can't be downloaded by a stranger, browsing roles, asking for an intro, hitting the cap of five, withdrawing, and deleting the account along with the file |
| `voucher-inbox.mjs` | The loop closing: a seeker asks, a voucher reads their profile and resume, a one-line vouch is refused, a real vouch is written, and the employer gains a candidate. Also checks a seeker who only asked at another company is invisible, and an unverified voucher can't reach the inbox |
| `employer-flow.mjs` | Posting a role (with the fee shown before you post, and imposed by the database), working the candidate list, and a hire — which needs both the employer and the seeker to confirm before any money is owed |
| `verification-flow.mjs` | The 6-digit work-email code: refusing a domain the company hasn't proven, issuing a code, storing only its fingerprint, counting down wrong guesses, and what verification unlocks |

## Running them

Three things first: `npm run dev` in one terminal, `npm run seed` so the demo
accounts exist, and `.env.local` filled in.

```bash
node tests/auth-flows.mjs
node --env-file=.env.local tests/invite-flow.mjs
node --env-file=.env.local tests/onboarding-paths.mjs
node --env-file=.env.local tests/verification-flow.mjs
node --env-file=.env.local tests/seeker-flow.mjs
node --env-file=.env.local tests/voucher-inbox.mjs
node --env-file=.env.local tests/employer-flow.mjs
```

The last two need the database keys because they check what actually landed in
the database, not just what the screen said.

They clean up after themselves — any accounts or companies they create are
deleted at the end.

## Note on email confirmation

`invite-flow.mjs` and `onboarding-paths.mjs` create their test accounts through
Supabase's admin API rather than the sign-up form, because this project has
"Confirm email" switched on and the built-in email service is rate-limited to a
few messages an hour. Everything after that point — onboarding, verification,
the dashboards — is exercised through the real screens.
