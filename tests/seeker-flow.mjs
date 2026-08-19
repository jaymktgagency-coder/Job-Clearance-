/**
 * tests/seeker-flow.mjs — the seeker's journey end to end.
 *
 * Profile editing, a real resume upload into the private bucket, browsing
 * roles, asking for an intro, hitting the cap of five, withdrawing, and
 * deleting the account along with the file.
 *
 * Run with:  node --env-file=.env.local tests/seeker-flow.mjs
 * (needs `npm run dev` running and `npm run seed` already done)
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, unlinkSync } from "node:fs";

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

// a seeker with nothing yet
const email = `seeker-${Date.now()}@vouchtest.dev`;
const { data: created, error: cErr } = await db.auth.admin.createUser({
  email, password: PASSWORD, email_confirm: true, user_metadata: { role: "seeker" },
});
if (cErr) { console.log("could not create the test account:", cErr.message); process.exit(1); }
const uid = created.user.id;
await db.from("users").insert({ id: uid, role: "seeker", full_name: "Flow Tester", email });
await db.from("seeker_profiles").insert({ user_id: uid });

const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});

// --- profile ---------------------------------------------------------------
console.log("\n--- profile ---");
await page.goto(`${BASE}/profile`);
await page.fill('input[name="headline"]', "Line cook, 5 years");
await page.fill('input[name="location"]', "Tacoma, WA");
await page.fill('input[name="years_experience"]', "5");
await page.fill('input[name="skills"]', "prep, grill, food safety");
await page.fill('input[name="desired_titles"]', "Line Cook, Sous Chef");
await page.fill('textarea[name="bio"]', "Five years on the line across two restaurants.");
await page.click('button:has-text("Save profile")');
await page.waitForTimeout(2500);

const { data: saved } = await db.from("seeker_profiles").select("headline, location, years_experience, skills, desired_titles").eq("user_id", uid).maybeSingle();
saved?.headline === "Line cook, 5 years" ? P("headline saved") : F("headline is " + saved?.headline);
saved?.years_experience === 5 ? P("years of experience saved as a number") : F("years is " + saved?.years_experience);
Array.isArray(saved?.skills) && saved.skills.length === 3 ? P("comma-separated skills became a proper list of 3") : F("skills: " + JSON.stringify(saved?.skills));
Array.isArray(saved?.desired_titles) && saved.desired_titles.length === 2 ? P("desired roles became a list of 2") : F("titles: " + JSON.stringify(saved?.desired_titles));

const notices = await page.locator('[data-testid="ai-notice"]').count();
notices > 0 ? P("the AI notice is visible on the profile page") : F("AI notice missing from profile");

// --- resume upload ---------------------------------------------------------
console.log("\n--- resume upload ---");
const tmp = "/tmp/test-resume.txt";
writeFileSync(tmp, "Flow Tester\nLine cook, 5 years\nPrep, grill, food safety.\n");
await page.setInputFiles('input[name="resume"]', tmp);
await page.click('button:has-text("Upload resume")');
await page.waitForTimeout(3500);

const { data: withResume } = await db.from("seeker_profiles").select("resume_path, resume_uploaded_at").eq("user_id", uid).maybeSingle();
withResume?.resume_path ? P(`resume recorded at ${withResume.resume_path}`) : F("no resume_path saved");
withResume?.resume_path?.startsWith(`${uid}/`) ? P("stored in a folder named after the person (what the rules match on)") : F("wrong folder: " + withResume?.resume_path);

const { data: listed } = await db.storage.from("resumes").list(uid);
(listed ?? []).length === 1 ? P("exactly one file in their folder") : F(`${(listed ?? []).length} files`);

// the bucket is private: an anonymous public URL must not work
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const publicUrl = anon.storage.from("resumes").getPublicUrl(withResume.resume_path).data.publicUrl;
const publicTry = await fetch(publicUrl);
!publicTry.ok ? P(`a public URL for the file is refused (HTTP ${publicTry.status})`) : F("the resume is publicly downloadable!");

// a signed-out stranger cannot download it either
const { error: strangerErr } = await anon.storage.from("resumes").download(withResume.resume_path);
strangerErr ? P("a signed-out stranger cannot download it") : F("a stranger downloaded the resume");

// --- browsing and asking ---------------------------------------------------
console.log("\n--- browsing roles ---");
await page.goto(`${BASE}/jobs`);
const jobCount = await page.locator("main a[href^='/jobs/']").count();
jobCount > 0 ? P(`${jobCount} open roles listed`) : F("no roles listed");
const jobsText = await page.locator("main").innerText();
jobsText.includes("Verified Domain") || jobsText.includes("Verified Business")
  ? P("company verification badges show in the list") : F("no badges in the job list");

await page.locator("main a[href^='/jobs/']").first().click();
await page.waitForLoadState("networkidle");
const detail = await page.locator("main").innerText();
detail.includes("Ask for an intro") ? P("the role page offers an intro request") : F("no request form");
(await page.locator('[data-testid="ai-notice"]').count()) > 0 ? P("the AI notice is on the role page too") : F("AI notice missing from role page");

await page.fill('textarea[name="message"]', "Five years on the line, can start immediately.");
await page.click('button:has-text("Ask for an intro")');
await page.waitForTimeout(3000);
const afterAsk = await page.locator("main").innerText();
afterAsk.includes("Request sent") ? P("the request was sent") : F("no confirmation: " + afterAsk.slice(0, 160));

const { data: reqs } = await db.from("intro_requests").select("id, job_id, status, message").eq("seeker_id", uid);
reqs?.length === 1 && reqs[0].status === "pending" ? P("one pending request in the database") : F(JSON.stringify(reqs));
reqs?.[0]?.message?.includes("Five years") ? P("their note was saved with it") : F("message missing");

// --- the cap of five -------------------------------------------------------
console.log("\n--- the cap of five ---");
const { data: openJobs } = await db.from("jobs").select("id").eq("status", "open");
// Fill up to exactly five, skipping any role already asked about.
const taken = new Set((reqs ?? []).map((r) => r.job_id));
for (const j of openJobs ?? []) {
  if (taken.size >= 5) break;
  if (taken.has(j.id)) continue;
  const { error } = await db.from("intro_requests").insert({ job_id: j.id, seeker_id: uid });
  if (!error) taken.add(j.id);
}
const { count: nowOpen } = await db.from("intro_requests").select("id", { count: "exact" }).eq("seeker_id", uid).eq("status", "pending");
nowOpen === 5 ? P("seeker now has 5 open requests") : F(`has ${nowOpen}`);

const spare = (openJobs ?? []).find((j) => !taken.has(j.id));
if (!spare) {
  F("no spare role left to test the cap against");
} else {
  await page.goto(`${BASE}/jobs/${spare.id}`);
  const capText = await page.locator("main").innerText();
  const askBtn = page.locator('button:has-text("Ask for an intro")');
  if ((await askBtn.count()) === 0) {
    F("no ask button on the page — the spare role was already requested");
  } else {
    (await askBtn.isDisabled())
      ? P("at the cap, the ask button is disabled")
      : F("ask button still enabled at the cap");
  }
  capText.includes("limit") ? P("and the reason is explained on screen") : F("cap not explained: " + capText.slice(-200));

  // the database refuses it too, not just the screen
  const { error: capErr } = await db.from("intro_requests").insert({ job_id: spare.id, seeker_id: uid });
  capErr && capErr.message.includes("open intro requests")
    ? P("the database refuses a 6th request independently of the screen")
    : F("database allowed a 6th: " + JSON.stringify(capErr));
}

// --- withdrawing -----------------------------------------------------------
console.log("\n--- withdrawing ---");
await page.goto(`${BASE}/requests`);
const listText = await page.locator("main").innerText();
listText.includes("5 of 5 open") ? P("the requests page shows 5 of 5 open") : F("count wrong: " + listText.slice(0, 140));
await page.locator('button:has-text("Withdraw")').first().click();
await page.waitForTimeout(2500);
const { count: afterWithdraw } = await db.from("intro_requests").select("id", { count: "exact" }).eq("seeker_id", uid).eq("status", "pending");
afterWithdraw === 4 ? P("withdrawing freed a slot (4 open)") : F(`${afterWithdraw} open after withdrawing`);

// --- deleting the account --------------------------------------------------
console.log("\n--- deleting the account ---");
await page.goto(`${BASE}/profile`);
await page.click('button:has-text("Delete my account")');
await page.fill('input[name="confirm"]', "DELETE");
await page.click('button:has-text("Delete everything")');
await page.waitForTimeout(4000);

const { data: goneUser } = await db.from("users").select("id").eq("id", uid).maybeSingle();
!goneUser ? P("their database rows are gone") : F("user row survived");
const { data: goneReqs } = await db.from("intro_requests").select("id").eq("seeker_id", uid);
(goneReqs ?? []).length === 0 ? P("their intro requests went with them") : F(`${goneReqs.length} requests left behind`);
const { data: goneFiles } = await db.storage.from("resumes").list(uid);
(goneFiles ?? []).length === 0 ? P("their resume file was deleted from storage too") : F(`${goneFiles.length} files left behind`);

unlinkSync(tmp);
await ctx.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
