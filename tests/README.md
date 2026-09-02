# Tests

**You don't need to run these.** Most of them drive a real browser through the
parts of Vouch a person actually clicks, so a change to sign-up or the
dashboards can be checked without doing it by hand every time. One of them
(`ai-layer.mts`) calls Claude for real instead.

## Browser tests

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

## The AI test

`ai-layer.mts` is different: no browser, and it calls the Anthropic API for
real, so it costs a few cents and takes a couple of minutes.

```bash
npm run test:ai
```

With no `ANTHROPIC_API_KEY` it exits quietly — that is a valid state, because
the app runs without one. With a key, 26 checks cover:

- reading a real PDF, a real Word `.docx`, and a text file, and refusing the
  old `.doc` format with an explanation rather than a guess
- the parser recording what a resume says — and **no** age, sex, race,
  nationality, religion, disability, or family status. There is no field for
  any of it, and the instructions forbid inferring it
- a strong candidate scoring above a weak one, both with reasoning attached
- a candidate with **no resume** still being scored, with the gaps listed
  rather than counted against them
- the reasoning never telling the employer to reject, drop, or screen out
  anyone — it is advice about reading order, not a decision
- **the same resume under two different names scoring the same.** If this one
  ever fails, stop and find out why before shipping anything

`tests/resolve-ts.mjs` is plumbing: it lets plain `node` import the app's
TypeScript files so the test exercises the real code rather than a copy.

## The Stripe test

`stripe-9a.mts` talks to Stripe for real, in test mode, where no money can
move. It refuses to run at all against a live key.

```bash
npm run test:stripe          # with the site running on :3000
```

15 checks, and the ones that matter are about the webhook: a call with no
signature is refused, a call with a forged signature is refused, and a
correctly signed one is accepted. Anyone on the internet can POST to that
address, so that check is the only thing standing between Stripe's word and
anyone else's.

It also asserts that what Stripe hands back to Vouch contains a brand and the
last four digits and **no full card number and no CVC** — the test creates a
real test card and greps the response for `4242424242424242`.

## The payout test

`stripe-9c.mts` covers the voucher's side of the money: setting up how they
get paid, which they are only ever asked to do after a vouch has turned into
a hire.

```bash
npm run test:9c
```

27 checks. The first one is the one to protect: **signed in as the actual
voucher with the publishable key**, it tries to set its own
`identity_verified_at` and `tax_info_collected_at` and asserts the database
refuses. Running that as `postgres` or with the secret key would prove nothing
— the guard deliberately trusts both, so the test would pass while the hole
was wide open.

The rest: an Express account is created once and not twice; a half-finished
onboarding opens neither gate; a finished one opens both; Stripe sending the
same update again does not move the verification date; and — the one that is
easy to leave out — **an account Stripe later restricts closes the identity
gate again**, so money never moves to an account Stripe has stopped trusting.

It ends with a real payout: held for "waiting on identity and tax", then back
in the queue and released once the details arrive.

Account creation is a real call to Stripe. The onboarding stages are
hand-built account objects, because there is no way to walk a person through
Stripe's hosted onboarding from a script — and a script that only tested the
happy path would never reach the restricted case at all.

## Note on email confirmation

`invite-flow.mjs` and `onboarding-paths.mjs` create their test accounts through
Supabase's admin API rather than the sign-up form, because this project has
"Confirm email" switched on and the built-in email service is rate-limited to a
few messages an hour. Everything after that point — onboarding, verification,
the dashboards — is exercised through the real screens.
