import { describe, expect, it } from "vitest";

import { buildInstallReadme, buildZip, crc32, sanitizeEntryName } from "@/lib/install-bundle";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface ParsedEntry {
  name: string;
  crc: number;
  size: number;
  content: Uint8Array;
}

/**
 * Independently reads the archive back the way an unzip tool would -- walking
 * the end-of-central-directory record, then the central directory, then each
 * local file header -- so a bug in the writer can't be masked by the writer's
 * own bookkeeping.
 */
function parseZip(archive: Uint8Array): ParsedEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

  let eocd = -1;
  for (let i = archive.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd, "end of central directory not found").toBeGreaterThanOrEqual(0);

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ParsedEntry[] = [];

  for (let i = 0; i < count; i++) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(archive.subarray(offset + 46, offset + 46 + nameLength));

    // The central directory must agree with the local header it points at.
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const contentStart = localOffset + 30 + localNameLength + localExtraLength;
    const content = archive.subarray(contentStart, contentStart + size);

    entries.push({ name, crc, size, content });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

describe("crc32", () => {
  it("matches the standard test vectors", () => {
    expect(crc32(encoder.encode(""))).toBe(0);
    expect(crc32(encoder.encode("a"))).toBe(0xe8b7be43);
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("sanitizeEntryName", () => {
  it("strips path separators so an entry can't escape the archive", () => {
    expect(sanitizeEntryName("../../etc/passwd")).toBe("etc_passwd");
    expect(sanitizeEntryName(String.raw`C:\Users\me\setup.sto`)).toBe("C:_Users_me_setup.sto");
  });

  it("falls back to a usable name for empty or control-character input", () => {
    expect(sanitizeEntryName("")).toBe("setup-file");
    expect(sanitizeEntryName("   ")).toBe("setup-file");
    expect(sanitizeEntryName("..")).toBe("setup-file");
    expect(sanitizeEntryName("a\u0000b")).toBe("ab");
  });
});

describe("buildZip", () => {
  it("round-trips multiple entries with correct names, sizes and CRCs", () => {
    const archive = buildZip([
      { name: "README.txt", content: encoder.encode("hello") },
      { name: "setup.json", content: encoder.encode('{"a":1}') },
    ]);

    const entries = parseZip(archive);
    expect(entries.map((entry) => entry.name)).toEqual(["README.txt", "setup.json"]);
    expect(decoder.decode(entries[0].content)).toBe("hello");
    expect(decoder.decode(entries[1].content)).toBe('{"a":1}');
    for (const entry of entries) {
      expect(entry.crc).toBe(crc32(entry.content));
      expect(entry.size).toBe(entry.content.length);
    }
  });

  it("handles an empty file and a payload larger than one 64 KiB block", () => {
    const big = encoder.encode("x".repeat(70_000));
    const archive = buildZip([
      { name: "empty.txt", content: new Uint8Array(0) },
      { name: "big.txt", content: big },
    ]);

    const entries = parseZip(archive);
    expect(entries[0].size).toBe(0);
    expect(entries[1].size).toBe(70_000);
    expect(decoder.decode(entries[1].content)).toBe(decoder.decode(big));
  });

  it("sanitizes entry names it was handed", () => {
    const archive = buildZip([{ name: "../../evil.txt", content: encoder.encode("x") }]);
    expect(parseZip(archive)[0].name).toBe("evil.txt");
  });

  it("is deterministic, so the same setup produces identical bytes", () => {
    const files = [{ name: "README.txt", content: encoder.encode("hello") }];
    expect(Buffer.from(buildZip(files)).equals(Buffer.from(buildZip(files)))).toBe(true);
  });

  it("marks names as UTF-8 and writes real sizes into the local header", () => {
    const archive = buildZip([{ name: "ünicode.txt", content: encoder.encode("xy") }]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800); // bit 11: UTF-8
    // Bit 3 must stay clear: it promises a trailing data descriptor, and
    // readers that trust it reject the archive when we don't write one.
    expect(view.getUint16(6, true) & 0x0008).toBe(0);
    // The local header carries the true sizes.
    expect(view.getUint32(18, true)).toBe(2);
    expect(view.getUint32(22, true)).toBe(2);

    expect(parseZip(archive)[0].name).toBe("ünicode.txt");
  });
});

describe("buildInstallReadme", () => {
  const setup = {
    car: "Ford Mustang GT3",
    track: "Zandvoort",
    game: "Assetto Corsa Competizione",
    condition: "Dry",
    lapTime: "1:35.000",
    author: "g30rpr",
    url: "https://setupsheet.app/setups/abc",
    rigProfile: "Wheel + 3 Pedals",
    fileName: "mustang-zandvoort.json",
  };

  const guide = resolveForReadme();

  function resolveForReadme() {
    return {
      folderPath: String.raw`Documents\Assetto Corsa Competizione\Setups\Ford Mustang GT3\Zandvoort`,
      folderNote: "Car and track folders must match ACC's own naming.",
      fileExtension: ".json",
      steps: ["Download the setup file.", "Move it into the folder below.", "Load it in-game."],
    };
  }

  it("names the setup, the source, the folder and each step", () => {
    const readme = buildInstallReadme(setup, guide, null);

    expect(readme).toContain("Ford Mustang GT3 @ Zandvoort");
    expect(readme).toContain("https://setupsheet.app/setups/abc");
    expect(readme).toContain("How to install".toUpperCase());
    expect(readme).toContain("1. Download the setup file.");
    expect(readme).toContain(String.raw`Documents\Assetto Corsa Competizione\Setups\Ford Mustang GT3\Zandvoort`);
    expect(readme).toContain("mustang-zandvoort.json");
    expect(readme).toContain("Community values are opinions, not a safety certification");
    // The folder caveat travels with the path -- a wrong folder is the most
    // likely way this ends in "the game can't see my setup".
    expect(readme).toContain("must match ACC's own naming");
  });

  it("omits the folder block for manual-entry games", () => {
    const readme = buildInstallReadme(
      { ...setup, game: "F1 25" },
      { folderPath: null, folderNote: null, fileExtension: null, steps: ["Enter values by hand."] },
      "Front Wing: 5"
    );

    expect(readme).not.toContain("DESTINATION FOLDER");
    expect(readme).toContain("SETUP VALUES");
    expect(readme).toContain("Front Wing: 5");
  });
});
