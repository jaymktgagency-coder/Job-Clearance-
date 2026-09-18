/**
 * /setup — a health-check page for you, the person building Vouch.
 *
 * Plain English: open http://localhost:3000/setup in your browser and this page
 * tells you which keys you've filled in, which are still missing, and whether
 * your Supabase project is actually answering. It's a checklist you can see.
 *
 * This is a "server component": the checking happens on the server, so your
 * secret keys are never sent to the browser. Only the pass/fail result is.
 */

import { checkEnv } from "@/lib/env";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import { checkDatabase } from "@/lib/supabase/db-status";
import { StatusMark } from "@/components/status-mark";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Always re-check on every visit rather than showing a cached result.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const { results, ready } = checkEnv();
  const connection = await checkSupabaseConnection();
  // Only worth asking about tables once we know the connection works.
  const database = connection.ok
    ? await checkDatabase()
    : { schemaApplied: false, companies: 0, jobs: 0, vouches: 0, message: "Not tested yet." };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Vouch setup check</h1>
      <p className="mt-2 text-muted-foreground">
        A running list of the keys this app needs. Edit{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.env.local</code>,
        restart the dev server, then refresh this page.
      </p>

      {/* Overall status, so you know at a glance whether Step 1 is done. */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Where you are
            {ready && connection.ok && database.companies > 0 ? (
              <Badge>Ready</Badge>
            ) : (
              <Badge variant="destructive">Not finished</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Everything below needs a tick before the app can show you anything
            real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-sunken p-4">
            <StatusMark state={connection.ok ? "done" : "failed"} className="mt-0.5" />
            <div>
              <p className="font-semibold">Supabase connection</p>
              <p className="text-sm text-muted-foreground">{connection.message}</p>
            </div>
          </div>
          {/* Step 2a: are the tables there, and is there anything in them? */}
          <div className="flex items-start gap-3 rounded-lg bg-sunken p-4">
            <StatusMark
              state={
                database.companies > 0
                  ? "done"
                  : database.schemaApplied
                    ? "attention"
                    : "failed"
              }
              className="mt-0.5"
            />
            <div>
              <p className="font-semibold">Database tables and demo data</p>
              <p className="text-sm text-muted-foreground">{database.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* One row per environment variable. */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Environment variables</CardTitle>
          <CardDescription>
            Values are never shown here — only whether they exist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.map((item) => (
            <div
              key={item.name}
              className="flex items-start gap-3 rounded-lg bg-sunken p-4"
            >
              <StatusMark
                state={item.set ? "done" : item.requiredNow ? "failed" : "waiting"}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm font-medium break-all">{item.name}</code>
                  {item.requiredNow ? (
                    <Badge variant="secondary">Required now</Badge>
                  ) : (
                    <Badge variant="outline">{item.neededFor}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="mt-8 text-sm text-muted-foreground">
        Stuck? <code className="rounded bg-muted px-1.5 py-0.5">SETUP.md</code> in
        the project folder has the click-by-click instructions for creating each
        account and finding each key.
      </p>
    </main>
  );
}
