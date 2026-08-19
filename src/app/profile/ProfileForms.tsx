/**
 * ProfileForms.tsx — the seeker's profile, resume, and account-deletion forms.
 */

"use client";

import { useActionState, useState } from "react";
import { saveProfile, uploadResume, removeResume, deleteAccount, type ProfileState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Feedback({ state }: { state: ProfileState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (!state.notice) return null;
  return <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{state.notice}</p>;
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
        <textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={values.bio}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
          placeholder="A few sentences. This is what a voucher reads before deciding whether to back you."
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4">
        <input type="checkbox" name="open_to_work" defaultChecked={values.open_to_work} className="mt-1" />
        <span className="text-sm">
          <span className="block font-medium">I&apos;m open to work right now</span>
          <span className="mt-1 block text-muted-foreground">
            Turn this off and you stay on Vouch, but stop appearing to vouchers.
          </span>
        </span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save profile"}
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
          <div className="text-sm">
            <p className="font-medium">{resumePath.split("/").pop()}</p>
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
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading..." : resumePath ? "Replace resume" : "Upload resume"}
        </Button>
      </form>
    </div>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-destructive/30 p-4">
      <p className="text-sm font-medium">Delete my account</p>
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
