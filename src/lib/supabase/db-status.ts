/**
 * supabase/db-status.ts — "have the database tables been created yet?"
 *
 * Plain English: the /setup page uses this to tell you where you are. It asks
 * the database two questions: do the tables exist, and is there any demo data
 * in them? It runs on the server using the secret key, so nothing sensitive
 * reaches the browser — only the answers do.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { isSet } from "@/lib/env";

export type DbStatus = {
  /** Have the Step 2a migrations been run? */
  schemaApplied: boolean;
  /** How many companies exist (0 means "not seeded yet"). */
  companies: number;
  jobs: number;
  vouches: number;
  /** A sentence you can act on. */
  message: string;
};

export async function checkDatabase(): Promise<DbStatus> {
  const empty = { schemaApplied: false, companies: 0, jobs: 0, vouches: 0 };

  if (!isSet("SUPABASE_SECRET_KEY")) {
    return { ...empty, message: "Add SUPABASE_SECRET_KEY to .env.local first." };
  }

  try {
    const db = await createAdminClient();

    // Note: a "head only" request answers 204 with no error even when the
    // table is missing, which would make an empty database look ready. Asking
    // for a real row makes Postgres tell us the truth.
    const counted = async (table: string) => {
      const { count, error } = await db
        .from(table)
        .select("id", { count: "exact" })
        .limit(1);
      if (error) throw error;
      return count ?? 0;
    };

    const companies = await counted("companies");
    const jobs = await counted("jobs");
    const vouches = await counted("vouches");

    if (companies === 0) {
      return {
        schemaApplied: true,
        companies,
        jobs,
        vouches,
        message: "Tables exist, but there's no data yet. Run `npm run seed`.",
      };
    }

    return {
      schemaApplied: true,
      companies,
      jobs,
      vouches,
      message: `Ready: ${companies} companies, ${jobs} jobs, ${vouches} vouches.`,
    };
  } catch (error) {
    // Supabase reports failures as a plain object, not a JavaScript Error,
    // so we read `.message` off it rather than assuming an Error instance.
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    // PostgREST says this when the table simply isn't there yet.
    if (message.includes("schema cache") || message.includes("does not exist")) {
      return {
        ...empty,
        message:
          "The database tables haven't been created yet. Paste the two files in supabase/migrations into the Supabase SQL Editor — SETUP.md Part 6 walks through it.",
      };
    }
    return { ...empty, message: `Could not check the database: ${message}` };
  }
}
