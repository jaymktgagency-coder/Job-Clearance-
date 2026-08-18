# Browser tests

**You don't need to run these.** They drive a real browser through the parts
of Vouch a person actually clicks, so a change to sign-up or the dashboards
can be checked without doing it by hand every time.

| File | What it covers |
|---|---|
| `auth-flows.mjs` | Signed-out visitors are redirected; all three roles sign in and see the right dashboard; verified, invited, and unverified vouchers each see the right status |
| `invite-flow.mjs` | The whole employer-invite path: creating a link, what the invited person sees, finishing onboarding as a *verified* voucher, the invitation being marked used, and the link refusing to work twice |
| `onboarding-paths.mjs` | Seeker, employer, and self-serve voucher onboarding, including a personal email address being refused with a pointer to the invite path |

## Running them

Three things first: `npm run dev` in one terminal, `npm run seed` so the demo
accounts exist, and `.env.local` filled in.

```bash
node tests/auth-flows.mjs
node --env-file=.env.local tests/invite-flow.mjs
node --env-file=.env.local tests/onboarding-paths.mjs
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
