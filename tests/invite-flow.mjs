/**
 * tests/invite-flow.mjs — the employer-invite path, start to finish.
 *
 * This is the path that matters for businesses with no company email domain:
 * an employer invites someone directly, and that invitation IS their
 * verification. It walks a real browser through:
 *
 *   employer creates an invitation
 *     -> the link names the company
 *     -> sign-up pre-selects "voucher" and names the company
 *     -> finishing onboarding produces a VERIFIED voucher
 *     -> the invitation is marked accepted and can't be reused
 *
 * Run with:  node --env-file=.env.local tests/invite-flow.mjs
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
const newEmail = `invited-${Date.now()}@brightpathdental.test`;

// --- 1. the employer creates an invitation --------------------------------
console.log("\n--- employer creates an invitation ---");
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "rosa.brightpath@gmail.test");
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");

await page.fill('input[name="email"]', newEmail);
await page.click('button:has-text("Create invitation link")');
await page.waitForSelector("code", { timeout: 15000 });
const link = (await page.locator("code").first().innerText()).trim();
link.includes("/invite/") ? P(`invitation link created: ${link.slice(0, 46)}...`) : F("no link produced");
const token = link.split("/invite/")[1];
await ctx.close();

// only a hash is stored
const { data: stored } = await db.from("voucher_invitations").select("token_hash, email, status").eq("email", newEmail).maybeSingle();
stored && stored.token_hash !== token && stored.token_hash.length === 64
  ? P("only a SHA-256 hash of the token is stored, never the token itself")
  : F("the raw token appears to be stored: " + JSON.stringify(stored));

// --- 2. the link explains itself ------------------------------------------
console.log("\n--- the invited person opens the link ---");
{
  const c = await browser.newContext();
  const p2 = await c.newPage();
  await p2.goto(`${BASE}/invite/${token}`);
  const body = await p2.locator("main").innerText();
  body.includes("Bright Path Dental") ? P("the link names the company that invited them") : F("company missing: " + body.slice(0, 200));
  body.includes("won't need to verify a work email") || body.includes("won’t need to verify a work email")
    ? P("explains no work email is needed") : F("explanation missing");
  await p2.click('a:has-text("Accept and create my account")');
  await p2.waitForLoadState("networkidle");
  const signup = await p2.locator("main").innerText();
  signup.includes("Bright Path Dental") ? P("sign-up names the inviting company") : F("company not carried to sign-up");
  const voucherChecked = await p2.locator('input[name="role"][value="voucher"]').isChecked();
  voucherChecked ? P("sign-up pre-selects the voucher role, picker still shown") : F("voucher not pre-selected");
  const rolesVisible = await p2.locator('input[name="role"]').count();
  rolesVisible === 3 ? P("all three roles remain choosable") : F("picker is missing options");
  await c.close();
}

// --- 3. finishing onboarding makes them a VERIFIED voucher ----------------
// Email confirmation is on for this project, so the account is created the
// way a confirmed sign-up would leave it, carrying the same metadata.
console.log("\n--- they finish setting up ---");
const { data: created, error: createErr } = await db.auth.admin.createUser({
  email: newEmail,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { role: "voucher", invite_token: token },
});
if (createErr) { F("could not create the account: " + createErr.message); }
else {
  const c = await browser.newContext();
  const p3 = await c.newPage();
  await p3.goto(`${BASE}/login`);
  await p3.fill('input[name="email"]', newEmail);
  await p3.fill('input[name="password"]', PASSWORD);
  await p3.click('button[type="submit"]');
  await p3.waitForLoadState("networkidle");

  p3.url().includes("/onboarding") ? P("a new account is sent to onboarding") : F("landed on " + p3.url());
  const onboarding = await p3.locator("main").innerText();
  onboarding.includes("Bright Path Dental") ? P("onboarding names the inviting company") : F("company missing at onboarding");
  onboarding.includes("no work email needed") ? P("tells them no work email is needed") : F("wording missing");

  await p3.fill('input[name="full_name"]', "Invited Tester");
  await p3.fill('input[name="job_title"]', "Dental Assistant");
  await p3.check('input[name="employer_permission"]');
  await p3.click('button[type="submit"]');
  // Wait for the redirect itself rather than for the network to go quiet —
  // the server action finishes after the page has already settled once.
  try {
    await p3.waitForURL("**/dashboard", { timeout: 15000 });
    P("finishing onboarding lands on the dashboard");
  } catch {
    const shown = await p3.locator('[role="alert"]').count();
    F("stayed on " + p3.url() + (shown ? " — form said: " + (await p3.locator('[role="alert"]').first().innerText()) : ""));
  }
  const dash = await p3.locator("main").innerText();
  dash.includes("Bright Path Dental") ? P("their dashboard shows the company") : F("company missing on dashboard");
  dash.includes("invited you directly") ? P("dashboard credits the employer invitation") : F("invite wording missing");
  await c.close();

  // --- 4. what the database actually says ---------------------------------
  const { data: vp } = await db.from("voucher_profiles")
    .select("status, verification_method, employer_permission_confirmed_at, companies(name)")
    .eq("user_id", created.user.id).maybeSingle();
  vp?.status === "verified" ? P("the database records them as VERIFIED") : F("status is " + vp?.status);
  vp?.verification_method === "employer_invite" ? P("verification method recorded as employer_invite") : F("method is " + vp?.verification_method);
  vp?.employer_permission_confirmed_at ? P("their employer-permission affirmation was recorded") : F("affirmation missing");

  const { data: inv } = await db.from("voucher_invitations").select("status, accepted_by").eq("email", newEmail).maybeSingle();
  inv?.status === "accepted" && inv?.accepted_by === created.user.id
    ? P("the invitation is marked accepted and tied to them") : F("invitation state: " + JSON.stringify(inv));

  // --- 5. the link cannot be reused ---------------------------------------
  const c2 = await browser.newContext();
  const p4 = await c2.newPage();
  await p4.goto(`${BASE}/invite/${token}`);
  const reuse = await p4.locator("main").innerText();
  reuse.includes("can't be used") || reuse.includes("can’t be used")
    ? P("the same link cannot be used a second time") : F("link still usable: " + reuse.slice(0, 150));
  await c2.close();

  // clean up the test account
  await db.auth.admin.deleteUser(created.user.id);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
