/**
 * The site's own public address. Set NEXT_PUBLIC_SITE_URL once a real domain
 * is attached; until then Vercel's production URL is used automatically.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
