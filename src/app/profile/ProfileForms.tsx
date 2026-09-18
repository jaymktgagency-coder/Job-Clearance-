/**
 * ProfileForms.tsx — the seeker's profile, resume, and account-deletion forms.
 */

"use client";

import { useActionState, useState } from "react";
import { saveProfile, uploadResume, removeResume, deleteAccount, type ProfileState } from "./actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Feedback({ state }: { state: ProfileState }) {
  if (state.error) return <FormError>{state.error}</FormError>;
  if (!state.notice) return null;
  return (
    <p
      role="status"
      className="rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success"
    >
      {state.notice}
    </p>
  );
}

export type ProfileValues = {
  full_name: string;
  headline: string;
  location: string;
  bio: string;
  years_experience: string;
  skills: string;
  desired_titles: string;
  open_to_work: boolean;
  postal_code: string;
};

export function ProfileForm({ values }: { values: ProfileValues }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, { error: null });

  return (
    <form action={action} className="space-y-5">
      <Feedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="full_name">Your name</Label>
        <Input id="full_name" name="full_name" defaultValue={values.full_name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="headline">Headline</Label>
        <Input id="headline" name="headline" defaultValue={values.headline} placeholder="Barista and shift lead, 4 years" />
        <p className="text-sm text-muted-foreground">
          The one line a voucher reads first. Say what you do, not what you want.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Where you&apos;re looking</Label>
          <Input id="location" name="location" defaultValue={values.location} placeholder="Seattle, WA" />
        </div>

      <div className="space-y-2">
        <Label htmlFor="postal_code">Your ZIP code (optional)</Label>
        <Input
          id="postal_code"
          name="postal_code"
          inputMode="numeric"
          maxLength={5}
          defaultValue={values.postal_code}
          placeholder="98107"
        />
        <p className="text-sm text-muted-foreground">
          Only used to work out how far a job is from you, so you can filter
          the list by distance. It is never shown to anybody.
        </p>
      </div>
        <div className="space-y-2">
          <Label htmlFor="years_experience">Years of experience</Label>
          <Input id="years_experience" name="years_experience" type="number" min={0} max={60} defaultValue={values.years_experience} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skills">Skills</Label>
        <Input id="skills" name="skills" defaultValue={values.skills} placeholder="espresso, opening/closing, inventory" />
        <p className="text-sm text-muted-foreground">Separated by commas.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desired_titles">Roles you want</Label>
        <Input id="desired_titles" name="desired_titles" defaultValue={values.desired_titles} placeholder="Barista, Shift Supervisor" />
        <p className="text-sm text-muted-foreground">Separated by commas.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Anything else worth knowing</Label>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={values.bio}
          placeholder="A few sentences. This is what a voucher reads before deciding whether to back you."
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-[160ms] ease-out hover:border-brand-300 hover:bg-brand-50/50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:shadow-raised">
        <input type="checkbox" name="open_to_work" defaultChecked={values.open_to_work} className="mt-0.5 size-4 accent-brand-500" />
        <span className="text-sm">
          <span className="block font-semibold">I&apos;m open to work right now</span>
          <span className="mt-1 block text-muted-foreground">
            Turn this off and you stay on Vouch, but stop appearing to vouchers.
          </span>
        </span>
      </label>

      <Button type="submit" size="lg" loading={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function ResumeForm({
  resumePath,
  uploadedAt,
}: {
  resumePath: string | null;
  uploadedAt: string | null;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(uploadResume, { error: null });

  return (
    <div className="space-y-4">
      <Feedback state={state} />

      {resumePath ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sunken p-4">
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold">{resumePath.split("/").pop()}</p>
            <p className="text-muted-foreground">
              Uploaded {uploadedAt ? new Date(uploadedAt).toLocaleDateString() : "recently"}
            </p>
          </div>
          <form action={removeResume}>
            <Button type="submit" variant="outline" size="sm">
              Remove
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No resume yet.</p>
      )}

      <form action={action} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="resume">{resumePath ? "Replace it" : "Upload your resume"}</Label>
          <Input
            id="resume"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            required
          />
          <p className="text-sm text-muted-foreground">PDF, Word, or plain text. Up to 5 MB.</p>
        </div>
        <Button type="submit" loading={pending}>
          {resumePath ? "Replace resume" : "Upload resume"}
        </Button>
      </form>
    </div>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg bg-destructive/6 p-4">
      <p className="text-sm font-semibold text-destructive">Delete my account</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This erases your profile, your resume file, and every intro request and
        vouch attached to you. It cannot be undone.
      </p>

      {open ? (
        <form action={deleteAccount} className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="confirm">Type DELETE to confirm</Label>
            <Input id="confirm" name="confirm" placeholder="DELETE" autoComplete="off" required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive">
              Delete everything
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      )}
    </div>
  );
}
