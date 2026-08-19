/**
 * tests/verification-flow.mjs — a voucher verifying by work email.
 *
 * Covers the whole 6-digit code path: the domain check, the code arriving,
 * wrong guesses, and the moment they become able to vouch.
 *
 * Run with:  node --env-file=.env.local tests/verification-flow.mjs
 * (needs `npm run dev` running and `npm run seed` already done)
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.VOUCH_BASE_URL ?? "http://localhost:3000";
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PASSWORD = "vouch-demo-1234";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

let pass = 0, fail = 0;
const P = (m) => { console.log("  PASS: " + m); pass++; };
const F = (m) => { console.log("  FAIL: " + m); fail++; };
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
const created = [];

async function makeVoucher(companySlug, workEmail) {
  const email = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@vouchtest.dev`;
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { role: "voucher" },
  });
  if (error) throw new Error(error.message);
  created.push(data.user.id);
  const { data: co } = await db.from("companies").select("id").eq("slug", companySlug).single();
  await db.from("users").insert({ id: data.user.id, role: "voucher", full_name: "Verify Tester", email });
  await db.from("voucher_profiles").insert({
    user_id: data.user.id, company_id: co.id, work_email: workEmail,
    verification_method: "work_email", employer_permission_confirmed_at: new Date().toISOString(),
  });
  return { email, id: data.user.id };
}

async function signedIn(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  return { ctx, page };
}

// --- 1. a company that has NOT proven its domain --------------------------
console.log("\n--- work email at a domain the company hasn't proven ---");
{
  const acct = await makeVoucher("bright-path-dental", "someone@brightpathdental.test");
  const { ctx, page } = await signedIn(acct.email);
  await page.goto(`${BASE}/verify`);
  await page.click('button:has-text("Send me a code")');
  await page.waitForTimeout(2500);
  const msg = (await page.locator('[role="alert"]').allInnerTexts()).join(" ");
  msg.includes("hasn't proven it owns") || msg.includes("hasn’t proven it owns")
    ? P("refused: the company hasn't proven that domain") : F("no refusal: " + msg.slice(0, 140));
  msg.includes("invite you directly") ? P("points them at the employer-invite path instead") : F("no pointer to invites");
  const { data: none } = await db.from("email_verifications").select("id").eq("user_id", acct.id);
  (none ?? []).length === 0 ? P("no code was created for an unprovable address") : F("a code was created anyway");
  await ctx.close();
}

// --- 2. the real path -----------------------------------------------------
console.log("\n--- work email at a proven domain ---");
const acct = await makeVoucher("northgate-coffee", "newstarter@northgatecoffee.test");
{
  const { ctx, page } = await signedIn(acct.email);
  const dash = await page.locator("main").innerText();
  dash.includes("Verify with your work email") ? P("the dashboard offers a link to verify") : F("no verify link on dashboard");

  await page.goto(`${BASE}/verify`);
  await page.click('button:has-text("Send me a code")');
  await page.waitForSelector('[data-testid="dev-code"]', { timeout: 15000 });
  const code = (await page.locator('[data-testid="dev-code"]').innerText()).trim();
  /^\d{6}$/.test(code) ? P(`a 6-digit code was issued (${code})`) : F("bad code: " + code);

  const { data: row } = await db.from("email_verifications").select("code_hash, attempts, expires_at")
    .eq("user_id", acct.id).is("consumed_at", null).maybeSingle();
  row && row.code_hash !== code && row.code_hash.length === 64
    ? P("only a fingerprint of the code is stored, never the code") : F("code stored badly: " + JSON.stringify(row));

  // a wrong guess
  const wrong = code === "000000" ? "111111" : "000000";
  await page.fill('input[name="code"]', wrong);
  await page.click('button:has-text("Verify me")');
  await page.waitForTimeout(2500);
  const wrongMsg = (await page.locator('[role="alert"]').allInnerTexts()).join(" ");
  wrongMsg.includes("tries left") ? P("a wrong code is refused and counts down the tries") : F("wrong-code message: " + wrongMsg.slice(0, 120));

  const { data: after } = await db.from("email_verifications").select("attempts")
    .eq("user_id", acct.id).is("consumed_at", null).maybeSingle();
  after?.attempts === 1 ? P("the failed attempt was recorded") : F("attempts = " + after?.attempts);

  // still not verified
  const { data: mid } = await db.from("voucher_profiles").select("status").eq("user_id", acct.id).maybeSingle();
  mid?.status === "unverified" ? P("still unverified after a wrong guess") : F("status is " + mid?.status);

  // the right code
  await page.fill('input[name="code"]', code);
  await page.click('button:has-text("Verify me")');
  await page.waitForTimeout(3000);
  const okMsg = (await page.locator("main").innerText());
  okMsg.includes("Verified") ? P("the correct code verifies them") : F("no success message: " + okMsg.slice(0, 160));

  const { data: vp } = await db.from("voucher_profiles").select("status, verification_method, verified_at").eq("user_id", acct.id).maybeSingle();
  vp?.status === "verified" ? P("the database records them as verified") : F("status is " + vp?.status);
  vp?.verification_method === "work_email" ? P("recorded as the work-email path") : F("method is " + vp?.verification_method);

  const { data: used } = await db.from("email_verifications").select("consumed_at").eq("user_id", acct.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  used?.consumed_at ? P("the code was burned after use") : F("the code is still usable");
  await ctx.close();
}

// --- 3. they can now see their inbox --------------------------------------
console.log("\n--- what verification unlocks ---");
{
  const { ctx, page } = await signedIn(acct.email);
  const body = await page.locator("main").innerText();
  body.includes("Verified") ? P("dashboard now shows them as verified") : F("still shows unverified");
  body.includes("people waiting") ? P("their vouch inbox is now visible") : F("inbox missing");
  await ctx.close();
}

// --- 4. re-using a burned code --------------------------------------------
console.log("\n--- a code cannot be reused ---");
{
  const { ctx, page } = await signedIn(acct.email);
  await page.goto(`${BASE}/verify`);
  const body = await page.locator("main").innerText();
  body.includes("already verified") || body.includes("verified by your work email")
    ? P("an already-verified voucher isn't asked to verify again") : F("verify page still asking: " + body.slice(0, 140));
  await ctx.close();
}

for (const id of created) await db.auth.admin.deleteUser(id);
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
