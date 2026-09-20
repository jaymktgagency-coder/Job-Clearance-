/**
 * cron-9d.mts — Step 9d's tests: the lock on the nightly job.
 *
 * /api/cron/nightly is a URL on the public internet that decides who is owed
 * money and whose unanswered report has become a dispute. The only thing
 * between it and a stranger is a shared secret, so the lock itself is what
 * these tests are about — not the sweeps, which the SQL suite already covers
 * check by check against a real database.
 *
 * This is the same shape as stripe-9a's forged-signature check, and it exists
 * for the same reason: the refusal is the feature.
 *
 *   - with no CRON_SECRET set, the route refuses everything with 503 rather
 *     than running the sweeps unauthenticated
 *   - with one set, a call carrying no secret is refused
 *   - a wrong secret is refused
 *   - a secret that is a prefix of the real one is refused (the length check
 *     in front of timingSafeEqual must not become a way in)
 *   - the correct secret gets past the gate
 *
 * Run it:
 *   npm run test:cron          (with the site running on :3000)
 *
 * The site it points at must be started with the same CRON_SECRET this test
 * is given, which is what tests/run-cron-9d.sh does for you.
 */

const SITE = process.env.TEST_SITE_URL ?? "http://localhost:3000";
const SECRET = (process.env.CRON_SECRET ?? "").trim();
const URL_ = `${SITE}/api/cron/nightly`;

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

/** Calls the cron route, optionally carrying a bearer token. */
async function call(token?: string): Promise<{ status: number; body: string }> {
  const res = await fetch(URL_, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  console.log(`\nAgainst ${URL_}`);

  if (!SECRET) {
    // The site under test was started WITHOUT a secret. That is one of the
    // cases worth proving, and it is the only one we can prove in this mode.
    console.log("\nNo CRON_SECRET — checking the route refuses to run at all");
    const none = await call();
    check("refuses with 503 when CRON_SECRET is unset", none.status === 503,
      `got ${none.status}`);
    check("says so rather than pretending it worked",
      none.body.includes("not configured"), none.body.slice(0, 80));
    const guessed = await call("anything-at-all");
    check("still refuses even when a caller supplies a token",
      guessed.status === 503, `got ${guessed.status}`);

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log("\n1. A caller with no secret");
  const anon = await call();
  check("refused", anon.status !== 200, `got ${anon.status}`);
  check("refused as 404, so the address is not confirmed to exist",
    anon.status === 404, `got ${anon.status}`);

  console.log("\n2. A caller with the wrong secret");
  const wrong = await call("definitely-not-the-secret");
  check("refused", wrong.status === 404, `got ${wrong.status}`);

  console.log("\n3. A caller with a PREFIX of the real secret");
  // The length check that keeps timingSafeEqual from throwing must reject
  // this, not wave it through.
  const prefix = await call(SECRET.slice(0, Math.max(1, SECRET.length - 1)));
  check("refused", prefix.status === 404, `got ${prefix.status}`);

  console.log("\n4. A caller with the real secret");
  const right = await call(SECRET);
  // 200 when the database is reachable, 500 when it is not. Either way the
  // gate opened, which is what this file is testing — a 404 here would mean
  // the correct secret was rejected.
  check("got past the gate", right.status !== 404, `got ${right.status}`);
  if (right.status === 200) {
    check("reported what each sweep did", right.body.includes("release_due_payouts"),
      right.body.slice(0, 120));
  } else {
    console.log(`  NOTE  gate opened but the sweeps failed (${right.status}) — ` +
      "expected when this test points at a site with no real database.");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
