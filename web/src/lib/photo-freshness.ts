/**
 * Listing-photo freshness check (client-side, before upload).
 *
 * Goal: listing photos should be taken of the actual item at posting time.
 * Rule (see `checkPhotoFreshness`):
 *   1. If the image carries an EXIF capture date (DateTimeOriginal, falling back to
 *      DateTimeDigitized, then DateTime) and it is more than 24 hours before now, reject.
 *   2. If there is no EXIF date, fall back to `file.lastModified` and reject only if
 *      that is clearly old (more than 24 hours ago).
 *   3. Otherwise allow. Missing/unreadable metadata is ALWAYS allowed: iOS Safari strips
 *      EXIF from photos taken via the camera, and a fresh capture must never be blocked.
 *
 * The parser is intentionally tiny and self-contained (no dependency): it only looks
 * for the EXIF/TIFF block in JPEG, HEIC/HEIF/AVIF (ISO-BMFF), PNG (eXIf) and WebP files
 * and reads a handful of date tags. Any parse problem returns null ("no date").
 */

export const MAX_PHOTO_AGE_MS = 24 * 60 * 60 * 1000;

export const STALE_PHOTO_MESSAGE =
  "This photo looks like it was taken earlier. Please take a new photo of the item now.";

/** Anything before this is treated as a bogus/unset timestamp and ignored. */
const MIN_PLAUSIBLE_MS = Date.UTC(2000, 0, 1);

export type FreshnessResult =
  | { ok: true; source: "exif" | "lastModified" | "none"; takenAt: number | null }
  | { ok: false; source: "exif" | "lastModified"; takenAt: number; message: string };

/** Reads bytes [start, end) of the underlying file/blob. */
export type RangeReader = (start: number, end: number) => Promise<Uint8Array>;

/** Pure decision logic, separated from file reading so it is easy to test. */
export function decideFreshness(
  exifTakenAt: number | null,
  lastModified: number | null | undefined,
  now: number = Date.now()
): FreshnessResult {
  if (exifTakenAt != null && exifTakenAt >= MIN_PLAUSIBLE_MS) {
    if (now - exifTakenAt > MAX_PHOTO_AGE_MS) {
      return { ok: false, source: "exif", takenAt: exifTakenAt, message: STALE_PHOTO_MESSAGE };
    }
    return { ok: true, source: "exif", takenAt: exifTakenAt };
  }
  if (lastModified != null && Number.isFinite(lastModified) && lastModified >= MIN_PLAUSIBLE_MS) {
    if (now - lastModified > MAX_PHOTO_AGE_MS) {
      return { ok: false, source: "lastModified", takenAt: lastModified, message: STALE_PHOTO_MESSAGE };
    }
    return { ok: true, source: "lastModified", takenAt: lastModified };
  }
  return { ok: true, source: "none", takenAt: null };
}

/** Browser entry point: check a File/Blob picked from an <input type="file">. */
export async function checkPhotoFreshness(
  file: Blob & { lastModified?: number },
  now: number = Date.now()
): Promise<FreshnessResult> {
  let takenAt: number | null = null;
  try {
    takenAt = await readCaptureTime(blobReader(file), file.size);
  } catch {
    takenAt = null;
  }
  return decideFreshness(takenAt, file.lastModified, now);
}

export function blobReader(blob: Blob): RangeReader {
  return async (start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

export function bytesReader(bytes: Uint8Array): RangeReader {
  return async (start, end) => bytes.subarray(Math.max(0, start), Math.min(bytes.length, end));
}

const HEAD_BYTES = 512 * 1024;
const MAX_EXIF_BYTES = 256 * 1024;

/**
 * Returns the capture time (ms since epoch) from embedded EXIF, or null if absent.
 * Never throws for malformed input.
 */
export async function readCaptureTime(read: RangeReader, size: number): Promise<number | null> {
  try {
    const head = await read(0, Math.min(size, HEAD_BYTES));
    if (head.length < 12) return null;
    const tiff = await findTiff(head, read, size);
    return tiff ? parseTiffDates(tiff) : null;
  } catch {
    return null;
  }
}

async function findTiff(head: Uint8Array, read: RangeReader, size: number): Promise<Uint8Array | null> {
  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8) return findJpegTiff(head);
  // PNG
  if (head[0] === 0x89 && ascii(head, 1, 3) === "PNG") return findPngTiff(head);
  // WebP
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WEBP") return findWebpTiff(head);
  // HEIC / HEIF / AVIF (ISO base media file format)
  if (ascii(head, 4, 4) === "ftyp") return findIsoBmffTiff(head, read, size);
  return null;
}

function findJpegTiff(b: Uint8Array): Uint8Array | null {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null; // start of scan / end: no more metadata
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    const start = i + 4;
    const end = Math.min(b.length, i + 2 + len);
    if (marker === 0xe1 && end - start > 6 && ascii(b, start, 4) === "Exif" && b[start + 4] === 0 && b[start + 5] === 0) {
      return b.subarray(start + 6, end);
    }
    i += 2 + len;
  }
  return null;
}

function findPngTiff(b: Uint8Array): Uint8Array | null {
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    if (type === "eXIf") return b.subarray(i + 8, Math.min(b.length, i + 8 + len));
    if (type === "IEND") return null;
    i += 12 + len;
  }
  return null;
}

function findWebpTiff(b: Uint8Array): Uint8Array | null {
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = u32le(b, i + 4);
    if (type === "EXIF") {
      let s = i + 8;
      if (ascii(b, s, 4) === "Exif" && b[s + 4] === 0 && b[s + 5] === 0) s += 6;
      return b.subarray(s, Math.min(b.length, i + 8 + len));
    }
    i += 8 + len + (len & 1);
  }
  return null;
}

type Box = { type: string; start: number; content: number; end: number };

function readBox(b: Uint8Array, i: number, limit: number): Box | null {
  if (i + 8 > limit) return null;
  let size = u32be(b, i);
  const type = ascii(b, i + 4, 4);
  let content = i + 8;
  if (size === 1) {
    if (i + 16 > limit) return null;
    size = u64be(b, i + 8);
    content = i + 16;
  } else if (size === 0) {
    size = limit - i;
  }
  if (size < content - i) return null;
  return { type, start: i, content, end: i + size };
}

function children(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  const limit = Math.min(end, b.length);
  let i = start;
  while (i < limit) {
    const box = readBox(b, i, limit);
    if (!box) break;
    out.push(box);
    i = box.end;
  }
  return out;
}

async function findIsoBmffTiff(head: Uint8Array, read: RangeReader, size: number): Promise<Uint8Array | null> {
  const meta = children(head, 0, head.length).find((x) => x.type === "meta");
  if (!meta) return null;
  // meta is a FullBox: 4 bytes version/flags before children.
  const kids = children(head, meta.content + 4, meta.end);
  const iinf = kids.find((x) => x.type === "iinf");
  const iloc = kids.find((x) => x.type === "iloc");
  if (!iinf || !iloc) return null;

  // iinf: FullBox, entry_count (u16 if v0, else u32), then infe boxes.
  const iinfVersion = head[iinf.content];
  const infeStart = iinf.content + 4 + (iinfVersion === 0 ? 2 : 4);
  let exifId: number | null = null;
  for (const infe of children(head, infeStart, iinf.end)) {
    if (infe.type !== "infe") continue;
    const v = head[infe.content];
    if (v < 2) continue;
    let p = infe.content + 4;
    const id = v === 2 ? u16be(head, p) : u32be(head, p);
    p += v === 2 ? 2 : 4;
    p += 2; // item_protection_index
    if (ascii(head, p, 4) === "Exif") {
      exifId = id;
      break;
    }
  }
  if (exifId == null) return null;

  // iloc
  let p = iloc.content;
  const v = head[p];
  p += 4;
  const offsetSize = head[p] >> 4;
  const lengthSize = head[p] & 0x0f;
  const baseOffsetSize = head[p + 1] >> 4;
  const indexSize = v === 1 || v === 2 ? head[p + 1] & 0x0f : 0;
  p += 2;
  const itemCount = v < 2 ? u16be(head, p) : u32be(head, p);
  p += v < 2 ? 2 : 4;
  for (let n = 0; n < itemCount && p < iloc.end; n++) {
    const id = v < 2 ? u16be(head, p) : u32be(head, p);
    p += v < 2 ? 2 : 4;
    let constructionMethod = 0;
    if (v === 1 || v === 2) {
      constructionMethod = u16be(head, p) & 0x0f;
      p += 2;
    }
    p += 2; // data_reference_index
    const baseOffset = uN(head, p, baseOffsetSize);
    p += baseOffsetSize;
    const extentCount = u16be(head, p);
    p += 2;
    let firstOffset = 0;
    let firstLength = 0;
    for (let e = 0; e < extentCount; e++) {
      p += indexSize;
      const off = uN(head, p, offsetSize);
      p += offsetSize;
      const len = uN(head, p, lengthSize);
      p += lengthSize;
      if (e === 0) {
        firstOffset = off;
        firstLength = len;
      }
    }
    if (id !== exifId) continue;
    if (constructionMethod !== 0) return null; // idat / item-offset storage: not supported
    const start = baseOffset + firstOffset;
    const length = Math.min(firstLength || MAX_EXIF_BYTES, MAX_EXIF_BYTES);
    if (start <= 0 || start >= size) return null;
    const data = await read(start, Math.min(size, start + length));
    if (data.length < 4) return null;
    // Exif item payload: u32 offset to the TIFF header, then (usually) "Exif\0\0".
    const tiffStart = 4 + u32be(data, 0);
    return tiffStart < data.length ? data.subarray(tiffStart) : null;
  }
  return null;
}

/** Parses the TIFF/EXIF block and returns the best capture timestamp, or null. */
export function parseTiffDates(t: Uint8Array): number | null {
  if (t.length < 8) return null;
  const order = ascii(t, 0, 2);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  const r16 = (o: number) => (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const r32 = (o: number) =>
    le
      ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) >>> 0
      : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>> 0;
  if (r16(2) !== 42) return null;

  const readIfd = (offset: number): Map<number, { type: number; count: number; valueAt: number }> => {
    const tags = new Map<number, { type: number; count: number; valueAt: number }>();
    if (offset < 8 || offset + 2 > t.length) return tags;
    const n = r16(offset);
    for (let k = 0; k < n; k++) {
      const e = offset + 2 + k * 12;
      if (e + 12 > t.length) break;
      const tag = r16(e);
      const type = r16(e + 2);
      const count = r32(e + 4);
      const byteSize = (type === 3 ? 2 : type === 4 ? 4 : 1) * count;
      const valueAt = byteSize <= 4 ? e + 8 : r32(e + 8);
      tags.set(tag, { type, count, valueAt });
    }
    return tags;
  };
  const str = (entry?: { type: number; count: number; valueAt: number }): string | null => {
    if (!entry || entry.type !== 2) return null;
    const end = Math.min(t.length, entry.valueAt + entry.count);
    if (entry.valueAt >= end) return null;
    return ascii(t, entry.valueAt, end - entry.valueAt).replace(/\0+$/, "").trim();
  };

  const ifd0 = readIfd(r32(4));
  const exifPtr = ifd0.get(0x8769);
  const exif = exifPtr ? readIfd(exifPtr.type === 3 ? r16(exifPtr.valueAt) : r32(exifPtr.valueAt)) : new Map();

  const candidates: Array<[string | null, string | null]> = [
    [str(exif.get(0x9003)), str(exif.get(0x9011))], // DateTimeOriginal + OffsetTimeOriginal
    [str(exif.get(0x9004)), str(exif.get(0x9012))], // DateTimeDigitized + OffsetTimeDigitized
    [str(ifd0.get(0x0132)), str(exif.get(0x9010))], // DateTime + OffsetTime
  ];
  for (const [date, offset] of candidates) {
    const ms = parseExifDate(date, offset);
    if (ms != null) return ms;
  }
  return null;
}

/**
 * EXIF dates look like "2026:10:06 09:15:42". With an offset tag ("-05:00") the instant
 * is exact; without one it is the camera's local wall-clock time, which we interpret in
 * the browser's local time zone (correct for photos taken on the same phone).
 */
export function parseExifDate(value: string | null, offset?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y < 1970 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
  const off = offset ? /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim()) : null;
  if (off) {
    const sign = off[1] === "-" ? -1 : 1;
    const minutes = sign * (Number(off[2]) * 60 + Number(off[3]));
    return Date.UTC(y, mo - 1, d, h, mi, s) - minutes * 60_000;
  }
  const local = new Date(y, mo - 1, d, h, mi, s).getTime();
  return Number.isFinite(local) ? local : null;
}

function ascii(b: Uint8Array, start: number, len: number): string {
  let s = "";
  const end = Math.min(b.length, start + len);
  for (let i = start; i < end; i++) s += String.fromCharCode(b[i]);
  return s;
}
function u16be(b: Uint8Array, i: number) {
  return ((b[i] << 8) | b[i + 1]) >>> 0;
}
function u32be(b: Uint8Array, i: number) {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
}
function u32le(b: Uint8Array, i: number) {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}
function u64be(b: Uint8Array, i: number) {
  return u32be(b, i) * 2 ** 32 + u32be(b, i + 4);
}
function uN(b: Uint8Array, i: number, n: number) {
  if (n === 0) return 0;
  if (n === 2) return u16be(b, i);
  if (n === 4) return u32be(b, i);
  if (n === 8) return u64be(b, i);
  return 0;
}
