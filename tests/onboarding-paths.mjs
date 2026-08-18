/**
 * tests/onboarding-paths.mjs — the seeker, employer, and self-serve voucher
 * paths through onboarding.
 *
 * Run with:  node --env-file=.env.local tests/onboarding-paths.mjs
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
const cleanup = [];

/** Creates a confirmed login carrying the role someone picked at sign-up. */
async function accountFor(role, extra = {}) {
  const email = `t-${role}-${Date.now()}@vouchtest.dev`;
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { role, ...extra },
  });
  if (error) throw new Error(error.message);
  cleanup.push(data.user.id);
  return { email, id: data.user.id };
}

async function signedInPage(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  return { ctx, page };
}

// --- seeker ---------------------------------------------------------------
console.log("\n--- seeker onboarding ---");
{
  const acct = await accountFor("seeker");
  const { ctx, page } = await signedInPage(acct.email);
  await page.fill('input[name="full_name"]', "Test Seeker");
  await page.fill('input[name="headline"]', "Line cook, 3 years");
  await page.fill('input[name="location"]', "Portland, OR");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
  page.url().includes("/dashboard") ? P("seeker finishes onboarding") : F("stuck at " + page.url());
  const body = await page.locator("main").innerText();
  body.includes("Line cook, 3 years") ? P("their headline shows on the dashboard") : F("headline missing");
  const { data: prof } = await db.from("seeker_profiles").select("headline, location").eq("user_id", acct.id).maybeSingle();
  prof?.location === "Portland, OR" ? P("profile saved to the database") : F("profile not saved");
  const { data: u } = await db.from("users").select("role").eq("id", acct.id).maybeSingle();
  u?.role === "seeker" ? P("recorded with the seeker role") : F("role is " + u?.role);
  await ctx.close();
}

// --- employer -------------------------------------------------------------
console.log("\n--- employer onboarding ---");
{
  const acct = await accountFor("employer");
  const { ctx, page } = await signedInPage(acct.email);
  await page.fill('input[name="full_name"]', "Test Employer");
  await page.fill('input[name="company_name"]', `Test Diner ${Date.now()}`);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
  page.url().includes("/dashboard") ? P("employer finishes onboarding") : F("stuck at " + page.url());
  const body = await page.locator("main").innerText();
  body.includes("Test Diner") ? P("their new company shows on the dashboard") : F("company missing");
  body.includes("Not verified yet") ? P("a brand-new company starts with no badge") : F("badge state wrong");
  const inviteBtn = page.locator('button:has-text("Create invitation link")');
  if (await inviteBtn.count()) {
    (await inviteBtn.isDisabled())
      ? P("an unverified company cannot invite vouchers yet")
      : F("unverified company could invite");
  } else {
    F("invite form not on the page (employer onboarding did not complete)");
  }
  const { data: m } = await db.from("company_members").select("member_role, company_id").eq("user_id", acct.id).maybeSingle();
  m?.member_role === "owner" ? P("they are the owner of the company they created") : F("membership wrong");
  if (m) cleanup.push({ company: m.company_id });
  await ctx.close();
}

// --- self-serve voucher, and the free-email rule --------------------------
console.log("\n--- self-serve voucher onboarding ---");
{
  const acct = await accountFor("voucher");
  const { ctx, page } = await signedInPage(acct.email);
  const options = await page.locator('select[name="company_id"] option').count();
  options > 1 ? P("voucher can choose from existing companies") : F("no companies to choose");

  await page.fill('input[name="full_name"]', "Test Voucher");
  await page.selectOption('select[name="company_id"]', { label: "Northgate Coffee" });
  await page.fill('input[name="work_email"]', "someone@gmail.com");
  await page.check('input[name="employer_permission"]');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const err = (await page.locator('[role="alert"]').count())
    ? await page.locator('[role="alert"]').first().innerText() : "";
  err.includes("personal email provider")
    ? P("a gmail address is refused, pointing at the invite path instead")
    : F("free email accepted or wrong message: " + err.slice(0, 120));

  // The form re-renders after a rejected submit, so set every field again
  // rather than assuming they survived.
  await page.fill('input[name="full_name"]', "Test Voucher");
  await page.selectOption('select[name="company_id"]', { label: "Northgate Coffee" });
  await page.fill('input[name="work_email"]', "someone@northgatecoffee.test");
  if (!(await page.locator('input[name="employer_permission"]').isChecked())) {
    await page.check('input[name="employer_permission"]');
  }
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
  page.url().includes("/dashboard") ? P("a work email address is accepted") : F("stuck at " + page.url());

  const { data: vp } = await db.from("voucher_profiles").select("status, verification_method, work_email").eq("user_id", acct.id).maybeSingle();
  vp?.status === "unverified" ? P("they start UNVERIFIED — the 6-digit code is Step 4") : F("status is " + vp?.status);
  vp?.verification_method === "work_email" ? P("recorded as the work-email path") : F("method is " + vp?.verification_method);

  const body = await page.locator("main").innerText();
  body.includes("can't vouch") || body.includes("can’t vouch") ? P("dashboard tells them they cannot vouch yet") : F("no blocked message");
  await ctx.close();
}

// tidy up
for (const item of cleanup) {
  if (typeof item === "string") await db.auth.admin.deleteUser(item);
  else if (item.company) await db.from("companies").delete().eq("id", item.company);
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
