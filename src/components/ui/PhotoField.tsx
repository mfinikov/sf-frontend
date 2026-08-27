"use client";

import { useState, type ChangeEvent } from "react";
import { Loader2, Trash2, User } from "lucide-react";
import {
  MAX_PHOTO_BYTES,
  isSupportedPhotoType,
  photoProblem,
} from "@/lib/contacts/photo";

/** Edge of the stored avatar, in pixels. */
const AVATAR_SIZE = 512;
const AVATAR_QUALITY = 0.85;
/** Refuse to decode a file far larger than any avatar needs to be. */
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;

/**
 * Centre-crop to a square and downscale, then encode as JPEG.
 *
 * Doing this in the browser is what keeps the stored data URL small — a 4 MB
 * camera photo lands around 60 KB, comfortably inside the API's limit, and the
 * list endpoint stays cheap because every row carries its avatar inline.
 */
async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");

    // JPEG has no alpha channel, so fill first or transparency turns black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const edge = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - edge) / 2,
      (bitmap.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );

    return canvas.toDataURL("image/jpeg", AVATAR_QUALITY);
  } finally {
    bitmap.close();
  }
}

/**
 * Photo picker for the contact form.
 *
 * The chosen image is held in a hidden input so it submits with the rest of the
 * form — which also means the edit form carries an existing photo through the
 * `PUT` instead of silently clearing it.
 */
export default function PhotoField({
  id,
  name,
  accept,
  defaultValue = "",
  describedBy,
}: {
  id: string;
  name: string;
  accept?: string;
  defaultValue?: string;
  describedBy?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hintId = `${id}-hint`;
  const problemId = `${id}-problem`;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input so re-picking the same file still fires a change event.
    event.target.value = "";
    if (!file) return;

    setProblem(null);

    if (!isSupportedPhotoType(file.type)) {
      setProblem("Choose a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setProblem(`That file is too large to read. Pick one under ${MAX_SOURCE_BYTES / 1024 / 1024} MB.`);
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await toSquareDataUrl(file);
      const rejected = photoProblem(dataUrl);
      if (rejected) {
        setProblem(rejected);
        return;
      }
      setValue(dataUrl);
    } catch {
      setProblem("That image could not be read. Try a different file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-4">
      <input type="hidden" name={name} value={value} />

      {value ? (
        /* A data: URL has nothing for next/image to fetch or optimise. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={value}
          alt="Selected profile photo"
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-hairline"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
        >
          <User className="h-6 w-6" strokeWidth={1.5} />
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={busy}
          aria-describedby={[hintId, problem ? problemId : null, describedBy]
            .filter(Boolean)
            .join(" ")}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80 disabled:opacity-60"
        />

        <p id={hintId} className="text-[12px] text-muted-foreground">
          JPEG, PNG, GIF, or WebP. Cropped square and resized to {AVATAR_SIZE}px,
          so anything up to {MAX_PHOTO_BYTES / 1024} KB stored.
        </p>

        {busy ? (
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Resizing…
          </p>
        ) : null}

        {problem ? (
          <p id={problemId} role="alert" className="text-[13px] text-destructive">
            {problem}
          </p>
        ) : null}

        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setProblem(null);
            }}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Remove photo
          </button>
        ) : null}
      </div>
    </div>
  );
}
