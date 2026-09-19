/**
 * admin-9f.mts — the lock on the screen that sends vouchers money.
 *
 * Paying somebody is the most consequential button in Vouch, and one
 * environment variable decides who may press it. This file is about that
 * decision and nothing else.
 *
 * The case worth caring about most is the boring one: **an unset
 * ADMIN_USER_IDS must mean nobody, never everybody.** A gate that falls open
 * when its configuration is missing is how a forgotten Vercel setting turns
 * into a stranger paying themselves.
 *
 *   npm run test:admin
 */

import {
  adminIsConfigured,
  adminUserIds,
  isAdminUserId,
} from "../src/lib/admin.ts";

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

/** Runs `fn` with ADMIN_USER_IDS set to `value`, then puts it back. */
function withAdmins(value: string | undefined, fn: () => void) {
  const before = process.env.ADMIN_USER_IDS;
  if (value === undefined) delete process.env.ADMIN_USER_IDS;
  else process.env.ADMIN_USER_IDS = value;
  try {
    fn();
  } finally {
    if (before === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = before;
  }
}

const ALICE = "3f1c2b8a-9d4e-4f6a-8b1c-2d3e4f5a6b7c";
const MALLORY = "00000000-0000-4000-8000-000000000001";

console.log("\n1. Nobody named");
withAdmins(undefined, () => {
  check("unset: no admins", adminUserIds().length === 0);
  check("unset: adminIsConfigured() is false", adminIsConfigured() === false);
  check("unset: a real-looking id is NOT an admin", isAdminUserId(ALICE) === false);
});
withAdmins("", () => {
  check("empty string: still nobody", isAdminUserId(ALICE) === false);
});
withAdmins("   ,  , ", () => {
  check("punctuation only: still nobody", isAdminUserId(ALICE) === false);
  check("punctuation only: not configured", adminIsConfigured() === false);
});

console.log("\n2. One admin named");
withAdmins(ALICE, () => {
  check("the named id is an admin", isAdminUserId(ALICE) === true);
  check("anybody else is not", isAdminUserId(MALLORY) === false);
  check("configured", adminIsConfigured() === true);
});

console.log("\n3. Nothing empty or absent counts as a match");
withAdmins(ALICE, () => {
  check("null is not an admin", isAdminUserId(null) === false);
  check("undefined is not an admin", isAdminUserId(undefined) === false);
  check("empty string is not an admin", isAdminUserId("") === false);
  check("whitespace is not an admin", isAdminUserId("   ") === false);
});

console.log("\n4. A near miss is a miss");
withAdmins(ALICE, () => {
  check("a prefix of a real id is refused", isAdminUserId(ALICE.slice(0, -1)) === false);
  check("the id plus a character is refused", isAdminUserId(ALICE + "0") === false);
  check("an id with an inner character changed is refused",
    isAdminUserId(ALICE.replace("3f1c", "3f1d")) === false);
});

console.log("\n5. Written how a person would actually paste it");
withAdmins(` ${ALICE.toUpperCase()} `, () => {
  // A UUID in capitals is the same UUID, and a stray space is a paste, not a
  // different person.
  check("capitals and surrounding spaces still match", isAdminUserId(ALICE) === true);
});
withAdmins(`${ALICE}, ${MALLORY}`, () => {
  check("comma separated: first is an admin", isAdminUserId(ALICE) === true);
  check("comma separated: second is an admin", isAdminUserId(MALLORY) === true);
  check("two admins named", adminUserIds().length === 2);
});
withAdmins(`${ALICE}\n${MALLORY}`, () => {
  check("newline separated also works", isAdminUserId(MALLORY) === true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
