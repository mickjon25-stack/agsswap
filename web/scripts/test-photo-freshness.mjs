// Unit tests for src/lib/photo-freshness.ts (listing-photo freshness rule).
// Run: npm test   (uses Node's built-in test runner; TypeScript is transpiled on the fly)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../src/lib/photo-freshness.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const out = join(mkdtempSync(join(tmpdir(), "freshness-")), "photo-freshness.mjs");
writeFileSync(out, js);
const F = await import(pathToFileURL(out).href);

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const fixture = (name) => new Uint8Array(readFileSync(join(here, "fixtures", name)));
const asFile = (bytes, name, lastModified) => new File([bytes], name, { type: "image/jpeg", lastModified });

// 2025:01:15 10:00:00 with OffsetTimeOriginal -06:00
const OLD_EXIF_UTC = Date.UTC(2025, 0, 15, 16, 0, 0);

// ---------- helpers to craft images in memory ----------
function tiffWithDate(date, { bigEndian = false, offset = null } = {}) {
  // IFD0: one entry (ExifIFD pointer). Exif IFD: DateTimeOriginal (+ OffsetTimeOriginal).
  const enc = new TextEncoder();
  const dateBytes = enc.encode(date + "\0"); // 20 bytes
  const offBytes = offset ? enc.encode(offset + "\0") : null; // 7 bytes
  const exifEntries = offBytes ? 2 : 1;
  const ifd0At = 8;
  const exifAt = ifd0At + 2 + 12 + 4;
  const dataAt = exifAt + 2 + exifEntries * 12 + 4;
  const buf = new Uint8Array(dataAt + dateBytes.length + (offBytes ? offBytes.length : 0));
  const dv = new DataView(buf.buffer);
  const le = !bigEndian;
  buf.set(enc.encode(bigEndian ? "MM" : "II"), 0);
  dv.setUint16(2, 42, le);
  dv.setUint32(4, ifd0At, le);
  dv.setUint16(ifd0At, 1, le);
  dv.setUint16(ifd0At + 2, 0x8769, le);
  dv.setUint16(ifd0At + 4, 4, le);
  dv.setUint32(ifd0At + 6, 1, le);
  dv.setUint32(ifd0At + 10, exifAt, le);
  dv.setUint16(exifAt, exifEntries, le);
  let e = exifAt + 2;
  dv.setUint16(e, 0x9003, le);
  dv.setUint16(e + 2, 2, le);
  dv.setUint32(e + 4, dateBytes.length, le);
  dv.setUint32(e + 8, dataAt, le);
  buf.set(dateBytes, dataAt);
  if (offBytes) {
    e += 12;
    dv.setUint16(e, 0x9011, le);
    dv.setUint16(e + 2, 2, le);
    dv.setUint32(e + 4, offBytes.length, le);
    dv.setUint32(e + 8, dataAt + dateBytes.length, le);
    buf.set(offBytes, dataAt + dateBytes.length);
  }
  return buf;
}

function jpegWithTiff(tiff) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0, 0, 1, 0, 1, 0, 0];
  const payload = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
  const len = payload.length + 2;
  return new Uint8Array([0xff, 0xd8, ...app0, 0xff, 0xe1, len >> 8, len & 0xff, ...payload, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}

function box(type, ...parts) {
  const body = parts.reduce((a, p) => new Uint8Array([...a, ...p]), new Uint8Array());
  const b = new Uint8Array(8 + body.length);
  new DataView(b.buffer).setUint32(0, b.length);
  b.set(new TextEncoder().encode(type), 4);
  b.set(body, 8);
  return b;
}
const u16 = (n) => [n >> 8, n & 0xff];
const u32 = (n) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

/** Minimal HEIC: ftyp + meta(hdlr, iinf[infe Exif], iloc) + mdat holding the Exif item. */
function heicWithTiff(tiff) {
  const exifItem = new Uint8Array([...u32(6), 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
  const ftyp = box("ftyp", new TextEncoder().encode("heic"), u32(0), new TextEncoder().encode("mif1heic"));
  const build = (mdatOffset) => {
    const hdlr = box("hdlr", u32(0), u32(0), new TextEncoder().encode("pict"), u32(0), u32(0), u32(0), [0]);
    const infeHvc = box("infe", [2, 0, 0, 0], u16(1), u16(0), new TextEncoder().encode("hvc1"), [0]);
    const infeExif = box("infe", [2, 0, 0, 0], u16(2), u16(0), new TextEncoder().encode("Exif"), [0]);
    const iinf = box("iinf", [0, 0, 0, 0], u16(2), infeHvc, infeExif);
    // iloc v1: offset_size=4, length_size=4, base_offset_size=0, index_size=0
    const iloc = box(
      "iloc", [1, 0, 0, 0], [0x44, 0x00], u16(2),
      u16(1), u16(0), u16(0), u16(1), u32(0), u32(0),
      u16(2), u16(0), u16(0), u16(1), u32(mdatOffset + 8), u32(exifItem.length)
    );
    return box("meta", [0, 0, 0, 0], hdlr, iinf, iloc);
  };
  const metaLen = build(0).length;
  const meta = build(ftyp.length + metaLen);
  const mdat = box("mdat", exifItem);
  return new Uint8Array([...ftyp, ...meta, ...mdat]);
}

// ---------- decision rule ----------
test("decideFreshness: EXIF older than 24h is rejected with the friendly message", () => {
  const now = Date.UTC(2026, 9, 6, 15);
  const r = F.decideFreshness(now - DAY - 1000, now, now);
  assert.equal(r.ok, false);
  assert.equal(r.source, "exif");
  assert.equal(r.message, "This photo looks like it was taken earlier. Please take a new photo of the item now.");
});

test("decideFreshness: EXIF within 24h (and exactly 24h, and future) is allowed", () => {
  const now = Date.UTC(2026, 9, 6, 15);
  assert.equal(F.decideFreshness(now - HOUR, undefined, now).ok, true);
  assert.equal(F.decideFreshness(now - DAY, undefined, now).ok, true);
  assert.equal(F.decideFreshness(now + 2 * HOUR, undefined, now).ok, true);
});

test("decideFreshness: no EXIF -> lastModified fallback only rejects when clearly old", () => {
  const now = Date.UTC(2026, 9, 6, 15);
  assert.deepEqual(F.decideFreshness(null, now - 1000, now), { ok: true, source: "lastModified", takenAt: now - 1000 });
  assert.equal(F.decideFreshness(null, now - 3 * DAY, now).ok, false);
  assert.equal(F.decideFreshness(null, now - 3 * DAY, now).source, "lastModified");
});

test("decideFreshness: no EXIF and no usable lastModified -> allowed (never block a camera capture)", () => {
  const now = Date.UTC(2026, 9, 6, 15);
  assert.deepEqual(F.decideFreshness(null, undefined, now), { ok: true, source: "none", takenAt: null });
  assert.equal(F.decideFreshness(null, 0, now).ok, true); // bogus epoch value ignored
  assert.equal(F.decideFreshness(null, NaN, now).ok, true);
});

test("decideFreshness: a fresh EXIF date wins over an old lastModified", () => {
  const now = Date.UTC(2026, 9, 6, 15);
  assert.equal(F.decideFreshness(now - HOUR, now - 10 * DAY, now).ok, true);
});

// ---------- real JPEG files (made with Pillow) ----------
test("JPEG with old EXIF DateTimeOriginal (+offset) is rejected", async () => {
  const file = asFile(fixture("exif-2025-01-15T10-00-00-0600.jpg"), "old.jpg", Date.now());
  const r = await F.checkPhotoFreshness(file, Date.UTC(2026, 9, 6, 15));
  assert.equal(r.ok, false);
  assert.equal(r.source, "exif");
  assert.equal(r.takenAt, OLD_EXIF_UTC);
});

test("same JPEG checked one hour after capture is allowed", async () => {
  const file = asFile(fixture("exif-2025-01-15T10-00-00-0600.jpg"), "old.jpg", Date.now());
  const r = await F.checkPhotoFreshness(file, OLD_EXIF_UTC + HOUR);
  assert.equal(r.ok, true);
  assert.equal(r.source, "exif");
});

test("JPEG with EXIF date but no offset is read as local time", async () => {
  const bytes = fixture("exif-local-2025-01-15T10-00-00.jpg");
  const expected = new Date(2025, 0, 15, 10, 0, 0).getTime();
  assert.equal(await F.readCaptureTime(F.bytesReader(bytes), bytes.length), expected);
  const r = await F.checkPhotoFreshness(asFile(bytes, "x.jpg", Date.now()), Date.now());
  assert.equal(r.ok, false);
});

test("JPEG without EXIF (iOS camera capture) + fresh lastModified is allowed", async () => {
  const now = Date.now();
  const r = await F.checkPhotoFreshness(asFile(fixture("no-exif.jpg"), "image.jpg", now - 5000), now);
  assert.equal(r.ok, true);
  assert.equal(r.source, "lastModified");
});

test("JPEG without EXIF and without lastModified (plain Blob) is allowed", async () => {
  const r = await F.checkPhotoFreshness(new Blob([fixture("no-exif.jpg")]), Date.now());
  assert.deepEqual(r, { ok: true, source: "none", takenAt: null });
});

test("JPEG without EXIF but a file last modified 3 days ago is rejected", async () => {
  const now = Date.now();
  const r = await F.checkPhotoFreshness(asFile(fixture("no-exif.jpg"), "old.jpg", now - 3 * DAY), now);
  assert.equal(r.ok, false);
  assert.equal(r.source, "lastModified");
});

// ---------- crafted variants ----------
test("crafted big-endian (Motorola) EXIF in JPEG is parsed", async () => {
  const bytes = jpegWithTiff(tiffWithDate("2024:06:01 12:00:00", { bigEndian: true, offset: "+02:00" }));
  assert.equal(await F.readCaptureTime(F.bytesReader(bytes), bytes.length), Date.UTC(2024, 5, 1, 10));
});

test("crafted recent EXIF in JPEG is allowed", async () => {
  const now = Date.UTC(2026, 9, 6, 15, 0, 0);
  const bytes = jpegWithTiff(tiffWithDate("2026:10:06 09:58:00", { offset: "-05:00" })); // 2 min ago
  const r = await F.checkPhotoFreshness(new Blob([bytes]), now);
  assert.equal(r.ok, true);
  assert.equal(r.source, "exif");
});

test("crafted HEIC with old EXIF item is rejected; recent is allowed", async () => {
  const old = heicWithTiff(tiffWithDate("2025:03:01 08:00:00", { offset: "+00:00" }));
  assert.equal(await F.readCaptureTime(F.bytesReader(old), old.length), Date.UTC(2025, 2, 1, 8));
  const now = Date.UTC(2026, 9, 6, 15);
  assert.equal((await F.checkPhotoFreshness(new Blob([old]), now)).ok, false);
  const fresh = heicWithTiff(tiffWithDate("2026:10:06 14:30:00", { offset: "+00:00" }));
  assert.equal((await F.checkPhotoFreshness(new Blob([fresh]), now)).ok, true);
});

test("PNG with eXIf chunk is parsed", async () => {
  const tiff = tiffWithDate("2023:12:24 18:00:00", { offset: "+00:00" });
  const chunk = new Uint8Array([...u32(tiff.length), ...new TextEncoder().encode("eXIf"), ...tiff, 0, 0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk]);
  assert.equal(await F.readCaptureTime(F.bytesReader(png), png.length), Date.UTC(2023, 11, 24, 18));
});

test("garbage, truncated and zeroed-date inputs never throw and count as 'no date'", async () => {
  const cases = [
    new Uint8Array(0),
    new Uint8Array([0xff, 0xd8]),
    new Uint8Array(1000).fill(0xff),
    jpegWithTiff(tiffWithDate("2025:01:01 00:00:00")).subarray(0, 40),
    jpegWithTiff(tiffWithDate("0000:00:00 00:00:00")),
    new TextEncoder().encode("not an image at all, just text"),
  ];
  for (const bytes of cases) {
    assert.equal(await F.readCaptureTime(F.bytesReader(bytes), bytes.length), null);
    assert.equal((await F.checkPhotoFreshness(new Blob([bytes]))).ok, true);
  }
});

// Optional: real-world camera files (not committed). PHOTO_FIXTURE_DIR=/path npm test
const extra = process.env.PHOTO_FIXTURE_DIR;
if (extra && existsSync(extra)) {
  for (const name of readdirSync(extra)) {
    test(`real file ${name}: has a readable capture date`, async () => {
      const bytes = new Uint8Array(readFileSync(join(extra, name)));
      const t = await F.readCaptureTime(F.bytesReader(bytes), bytes.length);
      console.log(`    ${name}: ${t == null ? "no date" : new Date(t).toISOString()}`);
      assert.notEqual(t, null);
      assert.equal((await F.checkPhotoFreshness(new Blob([bytes]))).ok, false); // all are years old
    });
  }
}
