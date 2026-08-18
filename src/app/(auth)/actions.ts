/**
 * (auth)/actions.ts — what happens when someone submits the sign-up or
 * sign-in form.
 *
 * Plain English: these run on the server. The browser never sees the code, so
 * it can't be tampered with. Each one returns a plain-English message when
 * something goes wrong, which the form shows above the fields.
 */

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth";

export type FormState = { error: string | null; notice?: string | null };

const ROLES: Role[] = ["seeker", "voucher", "employer"];

/** Turns Supabase's terse errors into something a human can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account. Check both, or sign up if you're new.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "There's already an account with that email. Try signing in instead.";
  }
  if (m.includes("password")) {
    return "That password won't work — it needs to be at least 6 characters.";
  }
  if (m.includes("email")) {
    return "That doesn't look like a valid email address.";
  }
  return message;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");
  const inviteToken = String(formData.get("invite_token") ?? "").trim();

  if (!email || !password) return { error: "Please fill in both your email and a password." };
  if (!ROLES.includes(role as Role)) return { error: "Please choose how you'll be using Vouch." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stored on the login itself, so the choice survives even if the person
      // has to confirm their email before coming back.
      data: {
        role,
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      },
    },
  });

  if (error) return { error: friendly(error.message) };

  // No session means this project asks people to confirm their email first.
  if (!data.session) {
    return {
      error: null,
      notice:
        "Almost there — check your email for a confirmation link, then come back and sign in.",
    };
  }

  redirect("/onboarding");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Please enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message) };

  // Onboarding sends people straight on to their dashboard if they're done.
  redirect("/onboarding");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
