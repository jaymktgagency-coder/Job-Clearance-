/**
 * picture-form.tsx — choosing and replacing a profile picture.
 *
 * Plain English: the same control for all three — a seeker's photo, a
 * voucher's photo, and a company's logo. It shows what is there now, lets you
 * pick a new one, and shows you the new one straight away rather than after
 * the upload finishes.
 *
 * That instant preview matters more than it sounds. Uploading a photo from a
 * phone takes a few seconds, and without it the page sits unchanged for long
 * enough that people pick a second file thinking the first did not take.
 */

"use client";

import { useActionState, useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** What all three upload actions hand back. */
export type PictureState = { error: string | null; notice?: string | null };

export function PictureForm({
  currentUrl,
  name,
  uploadAction,
  removeAction,
  label = "Profile picture",
  hint = "A clear photo of your face. JPG, PNG, WebP or GIF, up to 2 MB.",
  contain = false,
}: {
  currentUrl: string | null;
  /** Used for the initials shown when there is no picture. */
  name: string | null;
  uploadAction: (prev: PictureState, formData: FormData) => Promise<PictureState>;
  /** Returns nothing, matching `removeResume` beside it — the page just re-renders. */
  removeAction: () => Promise<void>;
  label?: string;
  hint?: string;
  /** True for a company logo: fit it inside the circle instead of cropping. */
  contain?: boolean;
}) {
  const [state, action, pending] = useActionState<PictureState, FormData>(
    uploadAction,
    { error: null },
  );

  // The picture the person just chose, shown before it has been uploaded.
  const [preview, setPreview] = useState<string | null>(null);

  // A preview is a temporary handle to a file, and the browser keeps that file
  // alive until it is released. Without this, choosing six photos in a row
  // holds all six in memory.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Once the server has accepted it, the real URL arrives as a prop and the
  // local preview is no longer what anybody should be looking at.
  //
  // Adjusted during render rather than in an effect. React documents this
  // shape for "reset some state when a prop changes": an effect here would
  // render once with the stale preview and then immediately render again.
  const [lastNotice, setLastNotice] = useState(state.notice);
  if (state.notice !== lastNotice) {
    setLastNotice(state.notice);
    if (state.notice) setPreview(null);
  }

  return (
    <div className="space-y-4">
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.notice ? (
        <p
          role="status"
          className="rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          {state.notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-5">
        <Avatar
          src={preview ?? currentUrl}
          name={name}
          size="xl"
          contain={contain && !preview}
        />

        <form action={action} className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="picture">{currentUrl ? "Replace it" : label}</Label>
            <Input
              id="picture"
              name="picture"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
          <Button type="submit" loading={pending}>
            {currentUrl ? "Replace picture" : "Upload picture"}
          </Button>
        </form>
      </div>

      {currentUrl ? (
        <form action={removeAction}>
          <Button type="submit" variant="outline" size="sm">
            Remove picture
          </Button>
        </form>
      ) : null}
    </div>
  );
}
