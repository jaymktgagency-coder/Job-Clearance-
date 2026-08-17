/**
 * env.ts — one place that knows about every secret key the app uses.
 *
 * Plain English: your app needs passwords/keys to talk to other services
 * (Supabase, Anthropic, Resend...). Those live in a file called `.env.local`
 * that never gets committed to GitHub. This file reads them, and gives us a
 * friendly way to check which ones are missing so we can show a helpful page
 * instead of a scary crash.
 *
 * Rule of thumb used below:
 *   - Anything starting with NEXT_PUBLIC_ is visible in the browser. Only put
 *     keys here that are safe for the public to see.
 *   - Everything else is server-only and must never be sent to the browser.
 */

/** Describes one environment variable and what it's for. */
export type EnvVar = {
  name: string;
  /** What this key does, in plain English. */
  description: string;
  /** Which build step needs it, so the setup page can say "not needed yet". */
  neededFor: string;
  /** If false, the app still runs without it (feature just won't work yet). */
  requiredNow: boolean;
};

/**
 * The full list of keys this project will ever use.
 * Steps 2-8 of the build will flip `requiredNow` to true as we get to them.
 */
export const ENV_VARS: EnvVar[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    description:
      "The web address of your Supabase project (your database + login system).",
    neededFor: "Step 1 - database & login",
    requiredNow: true,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    description:
      "Supabase's public key. Safe for the browser to see. (On older Supabase projects this is labelled 'anon public'.)",
    neededFor: "Step 1 - database & login",
    requiredNow: true,
  },
  {
    name: "SUPABASE_SECRET_KEY",
    description:
      "Supabase's admin key. NEVER share this or put it in the browser. (On older projects it's labelled 'service_role'.)",
    neededFor: "Step 2 - seeding fake data, admin jobs",
    requiredNow: false,
  },
  {
    name: "ANTHROPIC_API_KEY",
    description:
      "Anthropic (Claude) key, used to read resumes and score candidate fit.",
    neededFor: "Step 8 - AI resume parsing & fit scores",
    requiredNow: false,
  },
  {
    name: "RESEND_API_KEY",
    description:
      "Resend key, used to send emails (the insider's 6-digit verification code).",
    neededFor: "Step 4 - insider email verification",
    requiredNow: false,
  },
  {
    name: "EMAIL_FROM",
    description:
      "The 'from' address on emails we send, e.g. Vouch <hello@yourdomain.com>.",
    neededFor: "Step 4 - insider email verification",
    requiredNow: false,
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    description:
      "Where the site lives. http://localhost:3000 on your laptop; your real domain once deployed.",
    neededFor: "Step 3 - login links that point back to the right place",
    requiredNow: false,
  },
];

/** Reads a variable straight from the environment. Empty string = not set. */
function read(name: string): string {
  // Note: Next.js replaces NEXT_PUBLIC_* variables at build time, so they must
  // be written out literally rather than looked up dynamically in browser code.
  switch (name) {
    case "NEXT_PUBLIC_SUPABASE_URL":
      return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    case "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":
      return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    case "NEXT_PUBLIC_SITE_URL":
      return process.env.NEXT_PUBLIC_SITE_URL ?? "";
    default:
      return process.env[name] ?? "";
  }
}

/** True if the variable has a value. */
export function isSet(name: string): boolean {
  return read(name).trim().length > 0;
}

/**
 * Checks every key and reports what's set and what's missing.
 * Used by the /setup page so you can see your progress at a glance.
 */
export function checkEnv() {
  const results = ENV_VARS.map((v) => ({ ...v, set: isSet(v.name) }));
  const missingRequired = results.filter((r) => r.requiredNow && !r.set);
  return { results, missingRequired, ready: missingRequired.length === 0 };
}

/**
 * The two Supabase values the browser is allowed to know.
 * Throws a clear, human-readable error if they're missing.
 */
export function supabasePublicConfig() {
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const key = read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured yet. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Visit http://localhost:3000/setup for step-by-step help.",
    );
  }
  return { url, key };
}

/**
 * The Supabase admin key. Server-side only — calling this from browser code
 * would be a security hole, so it refuses to run there.
 */
export function supabaseSecretKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SECRET_KEY must never be used in the browser.");
  }
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is missing. Add it to .env.local (Supabase dashboard → " +
        "Project Settings → API keys → secret / service_role).",
    );
  }
  return key;
}
