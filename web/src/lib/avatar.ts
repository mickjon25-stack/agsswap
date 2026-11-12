/** Client-side helpers for profile pictures. */

export const AVATAR_BUCKET = "avatars";
export const AVATAR_SIZE = 512;
export const AVATAR_TARGET_BYTES = 300 * 1024;
/** Reject absurdly large originals before trying to decode them. */
export const AVATAR_MAX_INPUT_BYTES = 25 * 1024 * 1024;

export class AvatarError extends Error {}

export function initialsFor(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + last).toUpperCase();
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Validate, center-crop to a square, resize to 512px and compress to
 * WebP (or JPEG where WebP encoding isn't supported), aiming for < 300 KB.
 */
export async function prepareAvatar(file: File): Promise<{ blob: Blob; ext: string }> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
    throw new AvatarError("That file isn't a photo. Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    throw new AvatarError(
      `That photo is too big (${(file.size / 1024 / 1024).toFixed(0)} MB). Please pick one under 25 MB.`
    );
  }

  let img: ImageBitmap | HTMLImageElement;
  try {
    img = await decode(file);
  } catch {
    throw new AvatarError(
      "We couldn't read that photo. If it's a HEIC photo, try a JPG or PNG, or take a screenshot of it."
    );
  }
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  if (!w || !h) throw new AvatarError("We couldn't read that photo. Please try another one.");

  const side = Math.min(w, h);
  const out = Math.min(AVATAR_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("Your browser couldn't process the photo. Please try again.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
  if ("close" in img) img.close();

  for (const type of ["image/webp", "image/jpeg"]) {
    for (const q of [0.85, 0.75, 0.65, 0.5]) {
      const blob = await toBlob(canvas, type, q);
      if (!blob || blob.type !== type) break; // encoder not supported → next type
      if (blob.size <= AVATAR_TARGET_BYTES) {
        return { blob, ext: type === "image/webp" ? "webp" : "jpg" };
      }
    }
  }
  throw new AvatarError("We couldn't shrink that photo enough. Please try a different one.");
}
