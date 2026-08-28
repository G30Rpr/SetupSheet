const TEXT_EXTENSIONS = new Set([".json", ".ini", ".txt", ".xml", ".csv", ".vbo"]);
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const MAX_SIGNATURE_BYTES = 512;

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Performs a small content/signature check before a user file reaches public
 * Storage. It is deliberately conservative: opaque simulator formats are
 * allowed through extension/size/Storage-policy validation, while formats
 * with a recognizable signature must not masquerade as another file type.
 */
export async function validateFileSignature(
  file: Blob,
  extension: string
): Promise<string | null> {
  const bytes = new Uint8Array(
    await file.slice(0, MAX_SIGNATURE_BYTES).arrayBuffer()
  );

  if (extension === ".zip") {
    return startsWithBytes(bytes, ZIP_SIGNATURE)
      ? null
      : "That file is not a valid ZIP archive.";
  }

  if (!TEXT_EXTENSIONS.has(extension)) return null;

  try {
    const sample = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (sample.includes("\u0000")) {
      return "That file contains binary data and cannot be uploaded as text.";
    }

    if (extension === ".json") {
      JSON.parse(await file.text());
    } else if (extension === ".xml" && !sample.includes("<")) {
      return "That file does not look like valid XML.";
    }
  } catch {
    return "That file content does not match its filename extension.";
  }

  return null;
}
