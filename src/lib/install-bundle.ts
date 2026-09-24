/**
 * Minimal ZIP writer -- enough to put a setup file plus a README into one
 * download without pulling in a compression dependency.
 *
 * Deliberately STORE-only (method 0, no compression): sim setup files are
 * small and already text, so deflate would save a few KB while making this
 * file several times longer and harder to trust. If a bundle ever grows past
 * a few MB, revisit rather than hand-rolling deflate.
 */

export interface BundledFile {
  /** Entry name inside the archive; path separators are not supported. */
  name: string;
  content: Uint8Array;
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
/**
 * Bit 11 only: entry names are UTF-8.
 *
 * Bit 3 ("sizes live in a trailing data descriptor") must stay clear. It is
 * tempting when streaming, but we know every size up front, and setting it
 * without actually writing descriptors makes readers disagree with our local
 * headers -- `unzip` rejects the result as "overlapped components (possible
 * zip bomb)".
 */
const FLAGS = 0x0800;
const METHOD_STORE = 0;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 1980-01-01 00:00 in MS-DOS date/time format. Fixed rather than "now" so the
 * same setup always produces byte-identical archives -- which makes the output
 * testable and lets a browser or CDN reuse it instead of re-downloading.
 */
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

/** Strips anything that would escape the archive or confuse an unzip tool. */
export function sanitizeEntryName(name: string): string {
  const base = name
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .join("_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return base.length > 0 ? base : "setup-file";
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value & 0xffff, true);
}

export function buildZip(files: BundledFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map((file) => {
    const nameBytes = encoder.encode(sanitizeEntryName(file.name));
    return { ...file, nameBytes, crc: crc32(file.content) };
  });

  const localSize = entries.reduce(
    (total, entry) => total + 30 + entry.nameBytes.length + entry.content.length,
    0
  );
  const centralSize = entries.reduce((total, entry) => total + 46 + entry.nameBytes.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  const encoderSink = encoder; // aliased for readability below

  let offset = 0;
  const centralOffsets: number[] = [];

  for (const entry of entries) {
    centralOffsets.push(offset);
    writeUint32(view, offset, LOCAL_HEADER_SIGNATURE);
    writeUint16(view, offset + 4, 20); // version needed
    writeUint16(view, offset + 6, FLAGS);
    writeUint16(view, offset + 8, METHOD_STORE);
    writeUint16(view, offset + 10, DOS_TIME);
    writeUint16(view, offset + 12, DOS_DATE);
    writeUint32(view, offset + 14, entry.crc);
    writeUint32(view, offset + 18, entry.content.length);
    writeUint32(view, offset + 22, entry.content.length);
    writeUint16(view, offset + 26, entry.nameBytes.length);
    writeUint16(view, offset + 28, 0); // extra field length
    offset += 30;
    output.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
    output.set(entry.content, offset);
    offset += entry.content.length;
  }

  const centralStart = offset;
  entries.forEach((entry, index) => {
    writeUint32(view, offset, CENTRAL_HEADER_SIGNATURE);
    writeUint16(view, offset + 4, 20); // version made by
    writeUint16(view, offset + 6, 20); // version needed
    writeUint16(view, offset + 8, FLAGS);
    writeUint16(view, offset + 10, METHOD_STORE);
    writeUint16(view, offset + 12, DOS_TIME);
    writeUint16(view, offset + 14, DOS_DATE);
    writeUint32(view, offset + 16, entry.crc);
    writeUint32(view, offset + 20, entry.content.length);
    writeUint32(view, offset + 24, entry.content.length);
    writeUint16(view, offset + 28, entry.nameBytes.length);
    writeUint16(view, offset + 30, 0); // extra field length
    writeUint16(view, offset + 32, 0); // comment length
    writeUint16(view, offset + 34, 0); // disk number
    writeUint16(view, offset + 36, 0); // internal attributes
    writeUint32(view, offset + 38, 0); // external attributes
    writeUint32(view, offset + 42, centralOffsets[index]);
    offset += 46;
    output.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  });

  writeUint32(view, offset, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(view, offset + 4, 0); // disk number
  writeUint16(view, offset + 6, 0); // disk with central directory
  writeUint16(view, offset + 8, entries.length);
  writeUint16(view, offset + 10, entries.length);
  writeUint32(view, offset + 12, offset - centralStart);
  writeUint32(view, offset + 16, centralStart);
  writeUint16(view, offset + 20, 0); // comment length

  void encoderSink;
  return output;
}

export interface InstallBundleSetup {
  car: string;
  track: string;
  game: string;
  condition: string;
  lapTime: string;
  author: string;
  url: string;
  rigProfile?: string;
  fileName?: string | null;
}

/**
 * The instructions a downloader would otherwise have to go back to the site
 * for. Plain text on purpose: it opens in Notepad on Windows, which is where
 * this audience is.
 */
export function buildInstallReadme(
  setup: InstallBundleSetup,
  guide: {
    folderPath: string | null;
    folderNote: string | null;
    fileExtension: string | null;
    steps: string[];
  },
  exportedValues: string | null
): string {
  const lines: string[] = [
    `${setup.car} @ ${setup.track}`,
    `${setup.game} · ${setup.condition} setup${setup.rigProfile ? ` · ${setup.rigProfile}` : ""}`,
    `Lap time: ${setup.lapTime} · shared by ${setup.author}`,
    `Source: ${setup.url}`,
    "",
    "HOW TO INSTALL",
    "--------------",
  ];

  guide.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));

  if (guide.folderPath) {
    lines.push("", "DESTINATION FOLDER", "-----------------", guide.folderPath);
    if (guide.folderNote) lines.push("", `Note: ${guide.folderNote}`);
  }

  if (guide.fileExtension && setup.fileName) {
    lines.push("", `Setup file included in this bundle: ${setup.fileName}`);
  }

  if (exportedValues) {
    lines.push("", "SETUP VALUES", "------------", exportedValues);
  }

  lines.push(
    "",
    "Shared via SetupSheet — free community sim racing setups.",
    "Community values are opinions, not a safety certification: back up your own setups before overwriting anything."
  );

  return `${lines.join("\n")}\n`;
}
