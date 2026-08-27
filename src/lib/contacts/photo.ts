/**
 * Profile-photo rules, shared by the form schema and the photo picker.
 *
 * A photo travels as a base64 data URL because the API stores it inline on the
 * contact row. These limits mirror the server's (`app/schemas.py`), so a bad
 * image is reported before the round trip rather than after it.
 */

/** Raster formats only — SVG can carry script and is rejected by the API too. */
export const PHOTO_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/** `accept` attribute for the file input. */
export const PHOTO_ACCEPT = PHOTO_MEDIA_TYPES.join(",");

/** The API's cap on the decoded image. */
export const MAX_PHOTO_BYTES = 1024 * 1024;

const SUPPORTED = new Set<string>(PHOTO_MEDIA_TYPES);

const PHOTO_DATA_URL = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

export function isSupportedPhotoType(mediaType: string): boolean {
  return SUPPORTED.has(mediaType.toLowerCase());
}

/** Bytes a base64 payload decodes to, without allocating the buffer. */
function decodedByteLength(payload: string): number {
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return (payload.length * 3) / 4 - padding;
}

/** Why this data URL is unusable, or `null` when it is fine. */
export function photoProblem(dataUrl: string): string | null {
  const match = PHOTO_DATA_URL.exec(dataUrl);
  if (!match) return "Photo must be a base64 image data URL.";

  const [, mediaType, payload] = match;
  if (!isSupportedPhotoType(mediaType)) {
    return `${mediaType} is not a supported image type. Use JPEG, PNG, GIF, or WebP.`;
  }
  if (decodedByteLength(payload) > MAX_PHOTO_BYTES) {
    return `Photo must be ${MAX_PHOTO_BYTES / 1024} KB or smaller.`;
  }
  return null;
}
