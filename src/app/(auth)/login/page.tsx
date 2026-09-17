/** /login — sign in to an existing account. */

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { AuthShell } from "@/components/auth-shell";
import { InlineLink } from "@/components/inline-link";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <AuthShell
      greet
      title="Welcome back."
      description="Sign in to pick up where you left off."
      footer={
        <>
          New here? <InlineLink href="/signup">Create an account</InlineLink>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
