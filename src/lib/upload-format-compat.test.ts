import { describe, expect, it } from "vitest";

import { validateFileSignature } from "@/lib/file-validation";
import {
  ALLOWED_SETUP_FILE_EXTENSIONS,
  ALLOWED_TELEMETRY_FILE_EXTENSIONS,
} from "@/lib/storage";
import { describeUploadTarget, type UploadKind } from "@/lib/upload-targets";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const makeId = () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

function sample(ext: string): Blob {
  if (ext === ".zip") return new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]);
  if (ext === ".json") return new Blob(['{"version":1}']);
  if (ext === ".xml") return new Blob(["<setup/>"]);
  if ([".ini", ".txt", ".csv", ".vbo"].includes(ext)) return new Blob(["key=value\n"]);
  return new Blob([bytes]); // An opaque sample; this does not certify the real game format.
}

async function checkFormats(kind: UploadKind, formats: readonly string[]) {
  for (const ext of formats) {
    const file = sample(ext);
    const target = describeUploadTarget(kind, `sample${ext}`, file.size, owner, makeId);
    expect(target.error, `${kind} ${ext}`).toBeNull();
    expect(target.target?.path).toMatch(new RegExp(`sample\\${ext.replace(".", "\\.")}$`));
    expect(await validateFileSignature(file, ext), `signature ${ext}`).toBeNull();
  }
}

describe("SetupSheet signed upload format compatibility", () => {
  it("accepts every declared setup extension with a minimally plausible sample", async () => {
    await checkFormats("setup", ALLOWED_SETUP_FILE_EXTENSIONS);
  });

  it("accepts every declared telemetry extension with a minimally plausible sample", async () => {
    await checkFormats("telemetry", ALLOWED_TELEMETRY_FILE_EXTENSIONS);
  });

  it("does not mint signed targets for unsupported extensions or oversized payloads", () => {
    for (const kind of ["setup", "telemetry"] as const) {
      for (const ext of [".exe", ".php", ".sh"]) {
        expect(describeUploadTarget(kind, `upload${ext}`, 10, owner, makeId).target).toBeNull();
      }
      expect(describeUploadTarget(kind, "test.csv", 11 * 1024 * 1024, owner, makeId).target).toBeNull();
    }
  });

  it("rejects invalid JSON and spoofed ZIP signatures even when extension is allowed", async () => {
    expect(await validateFileSignature(new Blob(["{bad"]), ".json")).not.toBeNull();
    expect(await validateFileSignature(new Blob(["bad zip"]), ".zip")).not.toBeNull();
  });
});
