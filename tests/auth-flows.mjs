/**
 * tests/auth-flows.mjs — drives a real browser through sign-in and the three
 * dashboards.
 *
 * You don't need to run this. It exists so that changes to sign-up, sign-in,
 * or the dashboards can be checked without clicking through by hand.
 *
 *   1. npm run dev        (in one terminal)
 *   2. npm run seed       (so the demo accounts exist)
 *   3. node tests/auth-flows.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.VOUCH_BASE_URL ?? "http://localhost:3000";
// This machine ships Chromium at a fixed path rather than downloading one.
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PASSWORD = "vouch-demo-1234";
let pass = 0, fail = 0;
const P = (m) => { console.log("  PASS: " + m); pass++; };
const F = (m) => { console.log("  FAIL: " + m); fail++; };

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

async function signIn(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for the redirect the action triggers, not just for a quiet network.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
}

async function asUser(email, fn) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, email);
  await fn(page);
  await ctx.close();
}

console.log("\n--- signed-out visitors ---");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dashboard`);
  page.url().includes("/login") ? P("visiting /dashboard signed out redirects to /login")
                                : F("dashboard reachable while signed out: " + page.url());
  await page.goto(`${BASE}/signup`);
  const roles = await page.locator('input[name="role"]').count();
  roles === 3 ? P("sign-up shows all three role choices") : F(`sign-up shows ${roles} roles`);
  await ctx.close();
}

console.log("\n--- seeker ---");
await asUser("jordan@seeker.test", async (page) => {
  const url = page.url();
  url.includes("/dashboard") ? P("seeker signs in and lands on the dashboard") : F("landed on " + url);
  const body = await page.locator("main").innerText();
  body.includes("Job seeker") ? P("dashboard shows the Job seeker role") : F("role badge missing");
  body.includes("5 open") ? P("shows the seeker at 5 open intro requests (the cap)") : F("open-request count missing: " + body.slice(0, 200));
  body.toLowerCase().includes("free") ? P("tells seekers it is free") : F("free-forever line missing");
});

console.log("\n--- voucher, verified by work email ---");
await asUser("tomas@northgatecoffee.test", async (page) => {
  const body = await page.locator("main").innerText();
  body.includes("Northgate Coffee") ? P("voucher dashboard names their company") : F("company missing");
  body.includes("Verified") ? P("shows they are verified") : F("verification status missing");
  body.includes("work email") ? P("says they were verified by work email") : F("verification method missing");
  body.includes("track record") || body.includes("vouches written") ? P("shows their track record") : F("reputation missing");
});

console.log("\n--- voucher, verified by employer invitation ---");
await asUser("marisol.private@gmail.test", async (page) => {
  const body = await page.locator("main").innerText();
  body.includes("Bright Path Dental") ? P("invited voucher sees their company") : F("company missing");
  body.includes("invited you directly") ? P("says verification came from the employer invitation") : F("invite wording missing: " + body.slice(0, 300));
});

console.log("\n--- voucher who never verified ---");
await asUser("lena@verdanthealth.test", async (page) => {
  const body = await page.locator("main").innerText();
  body.includes("can't vouch") || body.includes("can’t vouch") ? P("unverified voucher is told they cannot vouch yet") : F("no blocked message: " + body.slice(0, 300));
  body.includes("0 people waiting") ? P("unverified voucher sees an empty inbox (0 waiting)") : F("inbox count wrong");
});

console.log("\n--- employer, Verified Domain ---");
await asUser("erin@northgatecoffee.test", async (page) => {
  const body = await page.locator("main").innerText();
  body.includes("Verified Domain") ? P("employer shows the Verified Domain badge") : F("badge missing: " + body.slice(0, 200));
  body.includes("work email") ? P("explains staff can self-verify by work email") : F("explanation missing");
  const disabled = await page.locator('button:has-text("Create invitation link")').isDisabled();
  disabled === false ? P("verified employer can use the invite form") : F("invite form disabled for a verified employer");
});

console.log("\n--- employer with no domain (the Gmail business) ---");
await asUser("rosa.brightpath@gmail.test", async (page) => {
  const body = await page.locator("main").innerText();
  body.includes("Verified Business") ? P("Gmail-run business shows Verified Business") : F("badge missing: " + body.slice(0, 200));
  body.includes("no company email domain needed") || body.includes("without a company email domain") || body.includes("Invite your staff directly")
    ? P("tells them to invite staff directly") : F("invite guidance missing");
});

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
