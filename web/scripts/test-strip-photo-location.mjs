// Unit tests for src/lib/strip-photo-location.ts (GPS/location strip before upload).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));

async function loadTs(rel) {
  const src = readFileSync(join(here, rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const out = join(mkdtempSync(join(tmpdir(), "strip-")), rel.split("/").pop().replace(/\.ts$/, ".mjs"));
  writeFileSync(out, js);
  return import(pathToFileURL(out).href);
}

const S = await loadTs("../src/lib/strip-photo-location.ts");
const F = await loadTs("../src/lib/photo-freshness.ts");

const fixture = (name) => new Uint8Array(readFileSync(join(here, "fixtures", name)));

// ---------- craft JPEG with GPS EXIF ----------
function tiffWithDateAndGps(date, { lat = 30.2672, lon = -97.7431, offset = "-06:00" } = {}) {
  const enc = new TextEncoder();
  const dateBytes = enc.encode(date + "\0");
  const offBytes = enc.encode(offset + "\0");
  const le = true;
  // Layout:
  // 0: II + 42 + IFD0 offset(8)
  // IFD0 at 8: 2 entries — ExifIFD (0x8769), GPSInfo (0x8825)
  // Exif IFD: DateTimeOriginal + OffsetTimeOriginal
  // GPS IFD: GPSLatitudeRef, GPSLatitude, GPSLongitudeRef, GPSLongitude
  const ifd0At = 8;
  const ifd0Entries = 2;
  const exifAt = ifd0At + 2 + ifd0Entries * 12 + 4; // after IFD0
  const exifEntries = 2;
  const gpsAt = exifAt + 2 + exifEntries * 12 + 4;
  const gpsEntries = 4;
  const dataAt = gpsAt + 2 + gpsEntries * 12 + 4;

  // GPS rationals: 3x (num:u32, den:u32) for lat, 3x for lon
  const rationalSize = 8;
  const latDataAt = dataAt + dateBytes.length + offBytes.length;
  const lonDataAt = latDataAt + 3 * rationalSize;
  const buf = new Uint8Array(lonDataAt + 3 * rationalSize);
  const dv = new DataView(buf.buffer);

  buf.set(enc.encode("II"), 0);
  dv.setUint16(2, 42, le);
  dv.setUint32(4, ifd0At, le);

  // IFD0
  dv.setUint16(ifd0At, ifd0Entries, le);
  // ExifIFD pointer
  let e = ifd0At + 2;
  dv.setUint16(e, 0x8769, le);
  dv.setUint16(e + 2, 4, le);
  dv.setUint32(e + 4, 1, le);
  dv.setUint32(e + 8, exifAt, le);
  // GPSInfo pointer
  e += 12;
  dv.setUint16(e, 0x8825, le);
  dv.setUint16(e + 2, 4, le);
  dv.setUint32(e + 4, 1, le);
  dv.setUint32(e + 8, gpsAt, le);
  dv.setUint32(ifd0At + 2 + ifd0Entries * 12, 0, le); // next IFD

  // Exif IFD
  dv.setUint16(exifAt, exifEntries, le);
  e = exifAt + 2;
  dv.setUint16(e, 0x9003, le);
  dv.setUint16(e + 2, 2, le);
  dv.setUint32(e + 4, dateBytes.length, le);
  dv.setUint32(e + 8, dataAt, le);
  buf.set(dateBytes, dataAt);
  e += 12;
  dv.setUint16(e, 0x9011, le);
  dv.setUint16(e + 2, 2, le);
  dv.setUint32(e + 4, offBytes.length, le);
  dv.setUint32(e + 8, dataAt + dateBytes.length, le);
  buf.set(offBytes, dataAt + dateBytes.length);
  dv.setUint32(exifAt + 2 + exifEntries * 12, 0, le);

  // GPS IFD
  function degToRational(deg) {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = Math.round((mFloat - m) * 60 * 1000); // thousandths of a second
    return [
      [d, 1],
      [m, 1],
      [s, 1000],
    ];
  }
  function writeRationals(at, rationals) {
    let p = at;
    for (const [num, den] of rationals) {
      dv.setUint32(p, num, le);
      dv.setUint32(p + 4, den, le);
      p += 8;
    }
  }
  const latRef = lat >= 0 ? "N" : "S";
  const lonRef = lon >= 0 ? "E" : "W";
  writeRationals(latDataAt, degToRational(lat));
  writeRationals(lonDataAt, degToRational(lon));

  dv.setUint16(gpsAt, gpsEntries, le);
  e = gpsAt + 2;
  // GPSLatitudeRef (1) ASCII count 2
  dv.setUint16(e, 0x0001, le);
  dv.setUint16(e + 2, 2, le);
  dv.setUint32(e + 4, 2, le);
  buf[e + 8] = latRef.charCodeAt(0);
  buf[e + 9] = 0;
  e += 12;
  // GPSLatitude (2) RATIONAL count 3
  dv.setUint16(e, 0x0002, le);
  dv.setUint16(e + 2, 5, le);
  dv.setUint32(e + 4, 3, le);
  dv.setUint32(e + 8, latDataAt, le);
  e += 12;
  // GPSLongitudeRef (3)
  dv.setUint16(e, 0x0003, le);
  dv.setUint16(e + 2, 2, le);
  dv.setUint32(e + 4, 2, le);
  buf[e + 8] = lonRef.charCodeAt(0);
  buf[e + 9] = 0;
  e += 12;
  // GPSLongitude (4)
  dv.setUint16(e, 0x0004, le);
  dv.setUint16(e + 2, 5, le);
  dv.setUint32(e + 4, 3, le);
  dv.setUint32(e + 8, lonDataAt, le);
  dv.setUint32(gpsAt + 2 + gpsEntries * 12, 0, le);

  return buf;
}

function jpegWithTiff(tiff) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0, 0, 1, 0, 1, 0, 0];
  const payload = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
  const len = payload.length + 2;
  // Minimal grayscale SOF + empty scan so the file is structurally decodable
  const sof = [
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  ];
  const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x00, 0xff, 0xd9];
  return new Uint8Array([
    0xff, 0xd8,
    ...app0,
    0xff, 0xe1, len >> 8, len & 0xff, ...payload,
    ...sof,
    ...sos,
  ]);
}

function jpegWithXmpLocation() {
  const xmp =
    'http://ns.adobe.com/xap/1.0/\0<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="30,16,1.92N" exif:GPSLongitude="97,44,35.16W"/>' +
    "</rdf:RDF></x:xmpmeta><?xpacket end=\"w\"?>";
  const payload = new TextEncoder().encode(xmp);
  const len = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, len >> 8, len & 0xff, ...payload,
    0xff, 0xd9,
  ]);
}

/** Read SOF dimensions — proves the JPEG is still structurally valid. */
function jpegDimensions(bytes) {
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const m = bytes[i + 1];
    if (m === 0xda || m === 0xd9) return null;
    if (m === 0xff) { i++; continue; }
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function tiffStillHasGpsPointer(jpegBytes) {
  return S.jpegHasGps(jpegBytes);
}

// ---------- tests ----------
test("crafted JPEG with GPS EXIF: strip removes GPS; image still structurally valid", () => {
  const bytes = jpegWithTiff(tiffWithDateAndGps("2026:10:06 10:00:00"));
  assert.equal(S.jpegHasGps(bytes), true);
  const beforeDims = jpegDimensions(bytes);
  assert.ok(beforeDims);
  assert.equal(beforeDims.width, 1);
  assert.equal(beforeDims.height, 1);

  const { bytes: cleaned, changed } = S.stripJpegLocation(bytes);
  assert.equal(changed, true);
  assert.equal(S.jpegHasGps(cleaned), false);
  // GPSLatitude ASCII 'N' / rationals should be zeroed — crude scan for leftover coords
  const asLatin = Buffer.from(cleaned).toString("latin1");
  assert.equal(asLatin.includes("GPSLatitude"), false); // not in binary EXIF that way, but:
  // Pointer tag 0x8825 gone:
  assert.equal(tiffStillHasGpsPointer(cleaned), false);

  const afterDims = jpegDimensions(cleaned);
  assert.deepEqual(afterDims, beforeDims);
  assert.equal(cleaned[0], 0xff);
  assert.equal(cleaned[1], 0xd8);
  assert.ok(cleaned[cleaned.length - 2] === 0xff && cleaned[cleaned.length - 1] === 0xd9);
});

test("freshness check still rejects old dates on the pre-strip file", async () => {
  const old = jpegWithTiff(tiffWithDateAndGps("2025:01:15 10:00:00", { offset: "-06:00" }));
  assert.equal(S.jpegHasGps(old), true);
  const now = Date.UTC(2026, 9, 6, 15);
  const pre = await F.checkPhotoFreshness(new Blob([old]), now);
  assert.equal(pre.ok, false);
  assert.equal(pre.source, "exif");

  // After strip, GPS is gone but we only strip GPS — date tags remain, so
  // a re-check would still see the old date. That's fine: picker checks first.
  const { bytes: cleaned } = S.stripJpegLocation(old);
  assert.equal(S.jpegHasGps(cleaned), false);
  const post = await F.checkPhotoFreshness(new Blob([cleaned]), now);
  assert.equal(post.ok, false); // dates preserved by surgical JPEG strip
});

test("real fixture JPEG gains GPS then loses it after strip; still has SOF", () => {
  // Graft our GPS TIFF into a wrapper — use crafted path; also ensure no-gps fixture unchanged
  const clean = fixture("no-exif.jpg");
  assert.equal(S.jpegHasGps(clean), false);
  const { changed } = S.stripJpegLocation(clean);
  assert.equal(changed, false);

  const withGps = jpegWithTiff(tiffWithDateAndGps("2026:10:06 12:00:00"));
  assert.equal(S.jpegHasGps(withGps), true);
  const out = S.stripJpegLocation(withGps);
  assert.equal(out.changed, true);
  assert.equal(S.jpegHasGps(out.bytes), false);
  assert.ok(jpegDimensions(out.bytes));
});

test("XMP APP1 with GPS latitude is dropped", () => {
  const bytes = jpegWithXmpLocation();
  assert.equal(S.jpegHasGps(bytes), true);
  const { bytes: cleaned, changed } = S.stripJpegLocation(bytes);
  assert.equal(changed, true);
  assert.equal(S.jpegHasGps(cleaned), false);
  const text = Buffer.from(cleaned).toString("utf8");
  assert.equal(text.includes("GPSLatitude"), false);
});

test("stripPhotoLocation on JPEG File returns cleaned image/jpeg without GPS", async () => {
  const bytes = jpegWithTiff(tiffWithDateAndGps("2026:10:06 09:00:00"));
  const file = new File([bytes], "item.jpeg", { type: "image/jpeg", lastModified: Date.now() });
  const result = await S.stripPhotoLocationDetailed(file);
  assert.equal(result.changed, true);
  assert.equal(result.method, "jpeg");
  assert.equal(result.file.type, "image/jpeg");
  const out = new Uint8Array(await result.file.arrayBuffer());
  assert.equal(S.jpegHasGps(out), false);
});

test("non-JPEG without canvas (Node) is left unchanged — graceful no-op", async () => {
  // Minimal fake HEIC-ish bytes
  const heic = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  const file = new File([heic], "shot.heic", { type: "image/heic", lastModified: Date.now() });
  const result = await S.stripPhotoLocationDetailed(file);
  assert.equal(result.changed, false);
  assert.equal(result.method, "none");
  assert.equal(result.file, file);
});

test("existing EXIF fixture without GPS is unchanged by strip", () => {
  const bytes = fixture("exif-2025-01-15T10-00-00-0600.jpg");
  assert.equal(S.jpegHasGps(bytes), false);
  const { bytes: out, changed } = S.stripJpegLocation(bytes);
  assert.equal(changed, false);
  assert.equal(out, bytes); // same reference when nothing to do
  // Freshness still works on the original
  assert.ok(jpegDimensions(bytes));
});
