/**
 * geo.ts — how far apart two points are.
 *
 * Plain English: the same arithmetic as `miles_between` in migration 0016,
 * written once more in TypeScript because the job list filters in memory
 * rather than in SQL.
 *
 * Two copies of a formula is normally a smell. It is deliberate here: the
 * database needs it so a distance can be asked for in SQL, and the page needs
 * it so filtering does not become a round trip per role. The SQL test file
 * pins the database's version against real city distances; the pair are
 * checked against each other rather than trusted to agree.
 */

/** The earth's mean radius, in miles. */
const EARTH_RADIUS_MILES = 3958.7613;

export type Point = { latitude: number; longitude: number };

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in miles.
 *
 * The earth is not a sphere, so this is out by roughly a fifth of a percent —
 * about fifty feet over ten miles. Nobody deciding between a ten-mile and a
 * twenty-five-mile commute is affected by fifty feet.
 */
export function milesBetween(a: Point, b: Point): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * The distance as a person would say it.
 *
 * Deliberately vague, because the measurement is: these are ZIP centroids,
 * not doorsteps, so "12.3 miles" claims a precision that is not there.
 */
export function describeMiles(miles: number): string {
  if (miles < 1) return "under a mile away";
  if (miles < 10) return `about ${Math.round(miles)} miles away`;
  return `about ${Math.round(miles / 5) * 5} miles away`;
}
