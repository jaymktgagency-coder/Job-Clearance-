/**
 * geo.mts — the distance formula, pinned to the real world.
 *
 * The haversine exists twice: once in SQL (migration 0016) and once in
 * TypeScript (src/lib/geo.ts), because the database has to be able to answer
 * "how far" in a query and the job list has to answer it without a round trip
 * per role.
 *
 * Two copies of a formula drift. What stops that here is that BOTH are pinned
 * to the same outside truth — these city distances — rather than to each
 * other. 97_radius.sql asserts them against the SQL copy; this file asserts
 * the same numbers against the TypeScript copy. If either is edited into
 * disagreement, one of the two suites fails.
 *
 *   node --experimental-strip-types --import ./tests/resolve-ts.mjs tests/geo.mts
 */

import { milesBetween, describeMiles, type Point } from "../src/lib/geo.ts";

// Census 2023 ZCTA centroids for each ZIP, and the distance a person would
// look up. The windows are wide because these are ZIP centres, not doorsteps;
// they are here to catch a formula that is wrong by a factor or has latitude
// and longitude the wrong way round, not to certify a satnav.
const SEATTLE: Point = { latitude: 47.6113, longitude: -122.3342 };   // 98101
const BELLEVUE: Point = { latitude: 47.6189, longitude: -122.2015 };  // 98004
const TACOMA: Point = { latitude: 47.2529, longitude: -122.4426 };    // 98402
const PORTLAND: Point = { latitude: 45.5223, longitude: -122.6865 };  // 97205
const NEW_YORK: Point = { latitude: 40.7506, longitude: -73.9972 };   // 10001

const CASES: [string, Point, Point, number, number][] = [
  ["Seattle to Bellevue", SEATTLE, BELLEVUE, 3, 12],
  ["Seattle to Tacoma", SEATTLE, TACOMA, 20, 32],
  ["Seattle to Portland", SEATTLE, PORTLAND, 130, 160],
  ["Seattle to New York", SEATTLE, NEW_YORK, 2300, 2500],
];

let failed = 0;
const check = (ok: boolean, message: string) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed++;
};

console.log("distance, against distances a person can look up");
for (const [name, a, b, lo, hi] of CASES) {
  const d = milesBetween(a, b);
  check(d >= lo && d <= hi, `${name} — ${d.toFixed(1)} miles (expected ${lo}–${hi})`);
}

console.log("\nproperties that must hold whatever the inputs");
check(milesBetween(SEATTLE, SEATTLE) === 0, "a point is zero miles from itself");
check(
  Math.abs(milesBetween(SEATTLE, NEW_YORK) - milesBetween(NEW_YORK, SEATTLE)) < 1e-9,
  "the same in both directions",
);
// Guam and American Samoa are real US ZIPs on the far side of the antimeridian
// and below the equator. The formula must not fall over on either.
check(
  Number.isFinite(milesBetween(SEATTLE, { latitude: 13.451, longitude: 144.751 })),
  "copes with Guam, whose longitude is positive",
);
check(
  Number.isFinite(milesBetween(SEATTLE, { latitude: -14.324, longitude: -170.751 })),
  "copes with American Samoa, south of the equator",
);

console.log("\nhow it is worded on screen");
check(describeMiles(0.4) === "under a mile away", `0.4 -> "${describeMiles(0.4)}"`);
check(describeMiles(6.1) === "about 6 miles away", `6.1 -> "${describeMiles(6.1)}"`);
check(describeMiles(25.2) === "about 25 miles away", `25.2 -> "${describeMiles(25.2)}"`);

console.log(
  failed === 0
    ? `\nAll ${CASES.length + 7} checks passed.`
    : `\n${failed} check(s) FAILED.`,
);
process.exit(failed === 0 ? 0 : 1);
