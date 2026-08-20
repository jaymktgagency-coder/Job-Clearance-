/**
 * ai/resume-file.ts — turning an uploaded resume into something Claude can read.
 *
 * Plain English: people upload resumes in four shapes, and each needs
 * different handling:
 *
 *   .pdf   Claude reads PDFs directly — we hand the file over as-is.
 *   .txt   Plain text. Nothing to do.
 *   .docx  A modern Word file is secretly a zip folder full of XML. We open
 *          the zip, pull out the document, and strip the formatting tags.
 *   .doc   The old (pre-2007) Word format. Nobody can read these without a
 *          heavy library, so we say so honestly instead of guessing.
 *
 * The .docx reader below is written by hand on purpose. The alternative was
 * adding a document-parsing library for one job; this is about sixty lines and
 * uses only what Node.js already ships with.
 */

import { inflateRawSync } from "node:zlib";
import type Anthropic from "@anthropic-ai/sdk";

/** What we managed to make of the file. */
export type ResumeContent =
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string }
  | { kind: "unreadable"; reason: string };

// ---------------------------------------------------------------------------
// The little zip reader
// ---------------------------------------------------------------------------

/**
 * Finds one named file inside a zip archive and returns its bytes.
 *
 * A zip ends with a small index ("the central directory") listing everything
 * inside it. We find that index, walk it until we hit the file we want, then
 * jump to where the actual bytes live and un-squash them.
 */
function readFromZip(zip: Buffer, wanted: string): Buffer | null {
  // The index footer starts with these four marker bytes. It sits at the very
  // end of the file, so we scan backwards to find it.
  const EOCD_SIGNATURE = 0x06054b50;
  let footer = -1;
  for (let i = zip.length - 22; i >= 0 && i >= zip.length - 65_557; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) {
      footer = i;
      break;
    }
  }
  if (footer < 0) return null;

  const entryCount = zip.readUInt16LE(footer + 10);
  let cursor = zip.readUInt32LE(footer + 16); // where the index begins

  for (let n = 0; n < entryCount; n++) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== 0x02014b50) return null;

    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (name === wanted) {
      // The index says where the file's own little header is. The bytes come
      // straight after that header, whose length varies, so we read it too.
      if (zip.readUInt32LE(localOffset) !== 0x04034b50) return null;
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const slice = zip.subarray(start, start + compressedSize);
      // 0 = stored as-is, 8 = squashed with "deflate". Word always uses 8.
      if (method === 0) return Buffer.from(slice);
      if (method === 8) return inflateRawSync(slice);
      return null;
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** Turns Word's XML into readable text: paragraphs become line breaks. */
function xmlToText(xml: string): string {
  return xml
    .replace(/<w:p[ >]/g, "\n<w:p ")           // a new paragraph starts a new line
    .replace(/<w:br\s*\/>/g, "\n")             // an explicit line break
    .replace(/<w:tab\s*\/>/g, "\t")            // a tab
    .replace(/<[^>]+>/g, "")                   // drop every remaining tag
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")                    // must come last, or &amp;lt; breaks
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reads a .docx file. Returns null if it isn't a Word file after all. */
export function docxToText(bytes: Buffer): string | null {
  try {
    const document = readFromZip(bytes, "word/document.xml");
    if (!document) return null;
    const text = xmlToText(document.toString("utf8"));
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The part the rest of the app uses
// ---------------------------------------------------------------------------

/** Works out the file type from the storage path, e.g. "…/resume-123.docx". */
export function extensionOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/** Turns downloaded resume bytes into something we can send to Claude. */
export function readResume(bytes: Buffer, path: string): ResumeContent {
  const extension = extensionOf(path);

  if (extension === "pdf") {
    return { kind: "pdf", base64: bytes.toString("base64") };
  }

  if (extension === "txt" || extension === "text" || extension === "md") {
    const text = bytes.toString("utf8").trim();
    return text
      ? { kind: "text", text }
      : { kind: "unreadable", reason: "That text file is empty." };
  }

  if (extension === "docx") {
    const text = docxToText(bytes);
    return text
      ? { kind: "text", text }
      : {
          kind: "unreadable",
          reason:
            "We couldn't read that Word file. Saving it as a PDF and uploading again usually fixes it.",
        };
  }

  if (extension === "doc") {
    return {
      kind: "unreadable",
      reason:
        "That's the old Word format (.doc), which we can't read. Open it in Word and use " +
        "'Save as' to make a PDF or a .docx, then upload that.",
    };
  }

  return {
    kind: "unreadable",
    reason: `We don't know how to read a .${extension} file. Please upload a PDF, a Word document, or a text file.`,
  };
}

/**
 * Packages the resume as the content block Claude expects.
 * PDFs go over as a document; everything else goes over as text.
 */
export function asMessageContent(
  content: Extract<ResumeContent, { kind: "pdf" | "text" }>,
): Anthropic.ContentBlockParam {
  if (content.kind === "pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: content.base64 },
    };
  }
  return { type: "text", text: content.text };
}
