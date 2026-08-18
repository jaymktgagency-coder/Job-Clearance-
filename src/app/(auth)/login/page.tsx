/** /login — sign in to an existing account. */

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to Vouch</CardTitle>
          <CardDescription>Welcome back.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
