/**
 * avatars.ts — uploading and removing a profile picture.
 *
 * Plain English: the same three steps whether the picture is a seeker's, a
 * voucher's, or a company's logo — check the file, put it in the bucket, hand
 * back a web address to store. Only the column it eventually gets written to
 * differs, so that part is left to the caller.
 *
 * This is a plain library rather than part of an actions file on purpose: in a
 * `"use server"` file every single export has to be an async function, so a
 * helper like `pictureError` below could not live there.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "avatars";

/** 2 MB, matching the limit set on the bucket itself in migration 0013. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

/**
 * Why this file cannot be used, in words a person can act on — or null if it
 * is fine. Checked here as well as by the bucket because an error returned by
 * storage reads like a stack trace.
 */
export function pictureError(file: unknown): string | null {
  if (!(file instanceof File) || file.size === 0) {
    return "Please choose a picture first.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `That picture is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB — most phones can shrink a photo before sending it.`;
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Please use a JPG, PNG, WebP or GIF image.";
  }
  return null;
}

/**
 * Puts the picture in the bucket and returns its public web address.
 *
 * The file goes to `<user-id>/<random>.<ext>`:
 *
 *   * the folder is the user id, because that is what the storage rules match
 *     on — it is what stops anyone writing into somebody else's folder;
 *   * the name is random rather than something like `avatar.png`, because the
 *     bucket is public. A predictable name would mean that knowing somebody's
 *     user id is enough to fetch their picture directly.
 *
 * Every older file in the folder is deleted afterwards. That both replaces the
 * previous picture and sweeps up anything orphaned by a failure half way
 * through a previous attempt.
 */
export async function uploadPicture(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const extension = ALLOWED_IMAGE_TYPES.get(file.type) ?? "png";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  // A Blob goes up as application/octet-stream and the bucket refuses it, so
  // the bytes are handed over as a Buffer with the type stated outright.
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) return { error: `We couldn't upload that picture: ${error.message}` };

  await removeOtherPictures(supabase, userId, path);

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/**
 * Deletes every file in the person's folder except `keepPath`.
 *
 * Pass nothing to keep and it empties the folder, which is what removing a
 * picture and deleting an account both need.
 */
export async function removeOtherPictures(
  supabase: SupabaseClient,
  userId: string,
  keepPath?: string,
): Promise<void> {
  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const doomed = (files ?? [])
    .map((f) => `${userId}/${f.name}`)
    .filter((p) => p !== keepPath);

  if (doomed.length > 0) {
    await supabase.storage.from(AVATAR_BUCKET).remove(doomed);
  }
}
