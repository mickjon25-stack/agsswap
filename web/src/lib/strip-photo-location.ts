/**
 * Strip GPS / location metadata from listing photos before upload.
 *
 * Order of operations (see ListingPhotoPicker): freshness check runs on the
 * original file first (needs EXIF DateTimeOriginal); then this module cleans
 * the file; then the cleaned File is kept for upload.
 *
 * Strategy (zero dependency):
 *   - JPEG: rewrite markers — drop GPS IFD from EXIF APP1, drop location XMP
 *     APP1 segments. Image bits (DCT) and Orientation are preserved (no re-encode).
 *   - Other formats (HEIC/PNG/WebP) in the browser: draw via createImageBitmap
 *     → canvas → JPEG blob at quality 0.92, original dimensions. HEIC/PNG become
 *     JPEG. Safari's camera capture with capture=environment often already
 *     strips EXIF, so there may be nothing to remove — we handle that gracefully.
 *   - Profile/avatar uploads do not use this path.
 */

const JPEG_QUALITY = 0.92;

/** Location-ish strings we look for inside XMP packets. */
const XMP_LOCATION_RE =
  /gps|latitude|longitude|altitude|LocationShown|LocationCreated|photoshop:City|photoshop:State|photoshop:Country|Iptc4xmpCore:Location|Composite:GPS|exif:GPS/i;

export type StripResult = {
  file: File;
  /** true when bytes were rewritten (GPS/XMP removed or canvas re-encoded). */
  changed: boolean;
  method: "jpeg" | "canvas" | "none";
};

/** Browser entry: return a File safe to upload (GPS/location removed when possible). */
export async function stripPhotoLocation(file: File): Promise<File> {
  const result = await stripPhotoLocationDetailed(file);
  return result.file;
}

export async function stripPhotoLocationDetailed(file: File): Promise<StripResult> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isJpeg(bytes)) {
      const stripped = stripJpegLocation(bytes);
      if (stripped.changed) {
        const name = ensureJpegName(file.name);
        // Copy into a standalone ArrayBuffer so File's BlobPart typing is happy.
        const copy = Uint8Array.from(stripped.bytes);
        return {
          file: new File([copy], name, {
            type: "image/jpeg",
            lastModified: file.lastModified,
          }),
          changed: true,
          method: "jpeg",
        };
      }
      return { file, changed: false, method: "none" };
    }

    // Non-JPEG: canvas path when DOM APIs exist (browser). Node / SSR → leave as-is.
    if (canUseCanvas()) {
      const encoded = await reencodeViaCanvas(file);
      if (encoded) {
        return {
          file: new File([encoded], ensureJpegName(file.name), {
            type: "image/jpeg",
            lastModified: file.lastModified,
          }),
          changed: true,
          method: "canvas",
        };
      }
    }
    return { file, changed: false, method: "none" };
  } catch {
    return { file, changed: false, method: "none" };
  }
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/**
 * Pure JPEG rewrite: remove GPS IFD from Exif APP1 and drop location-bearing XMP.
 * Preserves image scan data. Never throws; on parse failure returns the input.
 */
export function stripJpegLocation(bytes: Uint8Array): { bytes: Uint8Array; changed: boolean } {
  if (!isJpeg(bytes)) return { bytes, changed: false };
  try {
    const segments = splitJpeg(bytes);
    if (!segments) return { bytes, changed: false };

    let changed = false;
    const out: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];

    for (const seg of segments) {
      if (seg.kind === "entropy") {
        out.push(seg.raw);
        continue;
      }
      // APP1 Exif
      if (seg.marker === 0xe1 && isExifApp1(seg.payload)) {
        const tiff = seg.payload.subarray(6);
        const cleaned = removeGpsFromTiff(tiff);
        if (cleaned.changed) {
          changed = true;
          const payload = new Uint8Array(6 + cleaned.tiff.length);
          payload.set([0x45, 0x78, 0x69, 0x66, 0, 0], 0);
          payload.set(cleaned.tiff, 6);
          out.push(buildAppSegment(0xe1, payload));
          continue;
        }
        out.push(seg.raw);
        continue;
      }
      // APP1 XMP (and XMP extension) — drop if it mentions location/GPS
      if (seg.marker === 0xe1 && isXmpApp1(seg.payload)) {
        const text = utf8Preview(seg.payload, 256 * 1024);
        if (XMP_LOCATION_RE.test(text)) {
          changed = true;
          continue; // drop segment
        }
        out.push(seg.raw);
        continue;
      }
      out.push(seg.raw);
    }

    if (!changed) return { bytes, changed: false };
    return { bytes: concat(out), changed: true };
  } catch {
    return { bytes, changed: false };
  }
}

/** True if the JPEG's Exif block has a GPS IFD pointer (tag 0x8825). */
export function jpegHasGps(bytes: Uint8Array): boolean {
  if (!isJpeg(bytes)) return false;
  try {
    const segments = splitJpeg(bytes);
    if (!segments) return false;
    for (const seg of segments) {
      if (seg.kind !== "marker") continue;
      if (seg.marker === 0xe1 && isExifApp1(seg.payload)) {
        if (tiffHasGpsPointer(seg.payload.subarray(6))) return true;
      }
      if (seg.marker === 0xe1 && isXmpApp1(seg.payload)) {
        if (XMP_LOCATION_RE.test(utf8Preview(seg.payload, 256 * 1024))) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ---------- JPEG segment IO ----------

type JpegSegment =
  | { kind: "marker"; marker: number; payload: Uint8Array; raw: Uint8Array }
  | { kind: "entropy"; raw: Uint8Array };

function splitJpeg(bytes: Uint8Array): JpegSegment[] | null {
  if (!isJpeg(bytes)) return null;
  const segs: JpegSegment[] = [];
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      // Unexpected: treat rest as entropy
      segs.push({ kind: "entropy", raw: bytes.subarray(i) });
      break;
    }
    let marker = bytes[i + 1];
    // Skip fill bytes (0xFF)
    while (marker === 0xff && i + 2 < bytes.length) {
      i++;
      marker = bytes[i + 1];
    }
    if (marker === 0xd9) {
      segs.push({ kind: "marker", marker, payload: new Uint8Array(), raw: bytes.subarray(i, i + 2) });
      i += 2;
      if (i < bytes.length) segs.push({ kind: "entropy", raw: bytes.subarray(i) });
      break;
    }
    // Standalone markers (no length)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segs.push({ kind: "marker", marker, payload: new Uint8Array(), raw: bytes.subarray(i, i + 2) });
      i += 2;
      continue;
    }
    // Start of Scan: rest (through EOI) is entropy-coded — keep as one blob
    if (marker === 0xda) {
      segs.push({ kind: "entropy", raw: bytes.subarray(i) });
      break;
    }
    if (i + 4 > bytes.length) return null;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) return null;
    const raw = bytes.subarray(i, i + 2 + len);
    const payload = bytes.subarray(i + 4, i + 2 + len);
    segs.push({ kind: "marker", marker, payload, raw });
    i += 2 + len;
  }
  return segs;
}

function buildAppSegment(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  const out = new Uint8Array(2 + 2 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (len >> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(payload, 4);
  return out;
}

function isExifApp1(payload: Uint8Array): boolean {
  return (
    payload.length > 6 &&
    payload[0] === 0x45 &&
    payload[1] === 0x78 &&
    payload[2] === 0x69 &&
    payload[3] === 0x66 &&
    payload[4] === 0 &&
    payload[5] === 0
  );
}

function isXmpApp1(payload: Uint8Array): boolean {
  // "http://ns.adobe.com/xap/1.0/\0" or "http://ns.adobe.com/xmp/extension/\0"
  if (payload.length < 29) return false;
  const head = utf8Preview(payload, 64);
  return head.startsWith("http://ns.adobe.com/xap/1.0/") || head.startsWith("http://ns.adobe.com/xmp/extension/");
}

// ---------- TIFF / GPS ----------

type IfdEntry = { tag: number; type: number; count: number; valueRaw: Uint8Array; inline: boolean };

function tiffHasGpsPointer(tiff: Uint8Array): boolean {
  const parsed = parseIfd0(tiff);
  return parsed ? parsed.entries.some((e) => e.tag === 0x8825) : false;
}

/**
 * Remove GPSInfo (0x8825) from IFD0. Orphaned GPS IFD bytes may remain but are
 * unreachable. Returns changed=false when no GPS pointer is present.
 */
export function removeGpsFromTiff(tiff: Uint8Array): { tiff: Uint8Array; changed: boolean } {
  const parsed = parseIfd0(tiff);
  if (!parsed) return { tiff, changed: false };
  const { le, ifd0Offset, entries, nextIfd } = parsed;
  const gpsEntry = entries.find((e) => e.tag === 0x8825);
  const kept = entries.filter((e) => e.tag !== 0x8825);
  if (kept.length === entries.length) return { tiff, changed: false };

  // Rebuild: copy original so Exif sub-IFD value blobs keep working at same offsets,
  // then rewrite IFD0 in place with one fewer entry. To avoid corrupting data that
  // sat immediately after the old IFD, we write the compacted IFD0 over the old one
  // and zero the trailing 12-byte gap that used to hold the removed entry / old next.
  const out = new Uint8Array(tiff);
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);

  // Zero the GPS IFD body (and its pointed-to rationals) before dropping the pointer.
  if (gpsEntry) {
    const gpsOffset = gpsIfdOffset(gpsEntry, dv, le);
    if (gpsOffset != null) zeroGpsIfd(out, dv, gpsOffset, le);
  }

  writeU16(dv, ifd0Offset, kept.length, le);
  let p = ifd0Offset + 2;
  for (const e of kept) {
    writeU16(dv, p, e.tag, le);
    writeU16(dv, p + 2, e.type, le);
    writeU32(dv, p + 4, e.count, le);
    // valueRaw is always 4 bytes (inline value or offset)
    out.set(e.valueRaw, p + 8);
    p += 12;
  }
  writeU32(dv, p, nextIfd, le);
  // Zero the leftover 12 bytes from the removed entry slot (was after next ptr before).
  const oldEnd = ifd0Offset + 2 + entries.length * 12 + 4;
  const newEnd = p + 4;
  for (let i = newEnd; i < oldEnd && i < out.length; i++) out[i] = 0;
  return { tiff: out, changed: true };
}

/** GPSInfo tag value is a LONG (type 4) offset; may be inline in the 4-byte field. */
function gpsIfdOffset(entry: IfdEntry, dv: DataView, le: boolean): number | null {
  // valueRaw sits at whatever absolute offset — use a view on those 4 bytes.
  const vdv = new DataView(entry.valueRaw.buffer, entry.valueRaw.byteOffset, 4);
  if (entry.type === 4 && entry.count === 1) return vdv.getUint32(0, le);
  if (entry.type === 3 && entry.count === 1) return vdv.getUint16(0, le);
  return null;
}

/** Overwrite GPS IFD entries and any out-of-line values (lat/long/alt rationals). */
function zeroGpsIfd(out: Uint8Array, dv: DataView, offset: number, le: boolean) {
  if (offset < 0 || offset + 2 > out.length) return;
  const n = readU16(dv, offset, le);
  if (n <= 0 || n > 64) return;
  for (let k = 0; k < n; k++) {
    const e = offset + 2 + k * 12;
    if (e + 12 > out.length) break;
    const type = readU16(dv, e + 2, le);
    const count = readU32(dv, e + 4, le);
    const unit = type === 3 ? 2 : type === 4 ? 4 : type === 5 || type === 10 ? 8 : 1;
    const byteSize = unit * count;
    if (byteSize > 4) {
      const dataAt = readU32(dv, e + 8, le);
      for (let i = dataAt; i < dataAt + byteSize && i < out.length; i++) out[i] = 0;
    }
    for (let i = e; i < e + 12; i++) out[i] = 0;
  }
  writeU16(dv, offset, 0, le); // empty IFD
  const nextAt = offset + 2 + n * 12;
  if (nextAt + 4 <= out.length) writeU32(dv, nextAt, 0, le);
}

function parseIfd0(
  tiff: Uint8Array
): { le: boolean; ifd0Offset: number; entries: IfdEntry[]; nextIfd: number } | null {
  if (tiff.length < 8) return null;
  const order = String.fromCharCode(tiff[0], tiff[1]);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (readU16(dv, 2, le) !== 42) return null;
  const ifd0Offset = readU32(dv, 4, le);
  if (ifd0Offset < 8 || ifd0Offset + 2 > tiff.length) return null;
  const n = readU16(dv, ifd0Offset, le);
  const entries: IfdEntry[] = [];
  for (let k = 0; k < n; k++) {
    const e = ifd0Offset + 2 + k * 12;
    if (e + 12 > tiff.length) break;
    const tag = readU16(dv, e, le);
    const type = readU16(dv, e + 2, le);
    const count = readU32(dv, e + 4, le);
    const valueRaw = tiff.slice(e + 8, e + 12);
    entries.push({ tag, type, count, valueRaw, inline: true });
  }
  const nextAt = ifd0Offset + 2 + n * 12;
  const nextIfd = nextAt + 4 <= tiff.length ? readU32(dv, nextAt, le) : 0;
  return { le, ifd0Offset, entries, nextIfd };
}

function readU16(dv: DataView, o: number, le: boolean) {
  return dv.getUint16(o, le);
}
function readU32(dv: DataView, o: number, le: boolean) {
  return dv.getUint32(o, le);
}
function writeU16(dv: DataView, o: number, v: number, le: boolean) {
  dv.setUint16(o, v, le);
}
function writeU32(dv: DataView, o: number, v: number, le: boolean) {
  dv.setUint32(o, v, le);
}

// ---------- Canvas fallback ----------

function canUseCanvas(): boolean {
  return (
    typeof createImageBitmap === "function" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  );
}

async function reencodeViaCanvas(file: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    // Apply EXIF orientation so portrait shots stay upright after metadata drop.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY)
    );
    return blob;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

// ---------- misc ----------

function ensureJpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function utf8Preview(bytes: Uint8Array, max: number): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, max));
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    let s = "";
    for (let i = 0; i < slice.length; i++) s += String.fromCharCode(slice[i]);
    return s;
  }
}
