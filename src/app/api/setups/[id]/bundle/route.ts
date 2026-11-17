import { NextResponse } from "next/server";

import {
  buildInstallReadme,
  buildZip,
  type BundledFile,
} from "@/lib/install-bundle";
import { resolveInstallGuide } from "@/lib/install-guides";
import {
  buildSetupExportText,
  buildSetupExportFilename,
} from "@/lib/setup-export";
import { sanitizeFileName } from "@/lib/storage";
import { getSetupById } from "@/lib/supabase/setups";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/utils";

const FILE_DOWNLOAD_TIMEOUT_MS = 10_000;
// Match the bucket's outer limit so existing attachments above the current
// 5 MiB setup-upload limit remain downloadable. The ZIP adds only bounded text.
const MAX_BUNDLE_FILE_BYTES = 10 * 1024 * 1024;

async function downloadSetupFile(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new DOMException("Setup file download timed out", "TimeoutError"),
    );
  }, FILE_DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    const contentLength = Number(response.headers.get("content-length"));
    if (
      !response.ok ||
      !response.body ||
      contentLength > MAX_BUNDLE_FILE_BYTES
    ) {
      void response.body?.cancel().catch(() => {});
      throw new Error("Setup file is unavailable or too large");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    // Cancel even a stalled body read when the deadline expires. Fetch's signal
    // bounds the headers request too; this listener keeps body cleanup explicit.
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    controller.signal.addEventListener("abort", cancel, { once: true });
    try {
      while (true) {
        controller.signal.throwIfAborted();
        const { done, value } = await reader.read();
        controller.signal.throwIfAborted();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BUNDLE_FILE_BYTES)
          throw new Error("Setup file is too large");
        chunks.push(value);
      }
    } finally {
      controller.signal.removeEventListener("abort", cancel);
      cancel();
      reader.releaseLock();
    }
    if (total === 0) throw new Error("Setup file is empty");

    const content = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      content.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return content;
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * One download that contains everything a driver needs: the setup file itself
 * (when the author attached one), a generated text copy of the tuning values,
 * and a README with the resolved install path for that game.
 *
 * A route handler rather than a Server Action on purpose -- the browser streams
 * it straight to disk and shows its own download progress, instead of the file
 * being base64'd through an RSC payload (which would inflate a 5 MB setup to
 * ~6.7 MB of JSON).
 *
 * Public, exactly like `downloadSetup`: no account is needed to download a
 * community setup, so requiring one here would be a silent regression.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "That setup id is invalid." },
      { status: 400 },
    );
  }

  const setup = await getSetupById(id);
  if (!setup) {
    return NextResponse.json({ error: "Setup not found." }, { status: 404 });
  }

  const guide = resolveInstallGuide(setup.game, setup);
  const hasValues = Boolean(
    setup.setupValues && Object.keys(setup.setupValues).length > 0,
  );
  if (!setup.fileUrl && !hasValues) {
    return NextResponse.json(
      { error: "This setup has no file or values to bundle." },
      { status: 404 },
    );
  }

  const files: BundledFile[] = [];
  const setupFileName = setup.fileName
    ? sanitizeFileName(setup.fileName)
    : buildSetupExportFilename(setup, guide.fileExtension ?? ".txt");

  if (setup.fileUrl) {
    try {
      files.push({
        name: setupFileName,
        content: await downloadSetupFile(setup.fileUrl),
      });
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === "TimeoutError";
      logger.error("install bundle: attachment unavailable", { id, timedOut });
      return NextResponse.json(
        {
          error: timedOut
            ? "The setup file took too long to download. Please try again."
            : "The setup file is unavailable. Please try again.",
        },
        {
          status: timedOut ? 504 : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  }

  const exportedValues = hasValues ? buildSetupExportText(setup) : null;
  if (exportedValues && !setup.fileUrl) {
    files.push({
      name: buildSetupExportFilename(setup, ".txt"),
      content: new TextEncoder().encode(exportedValues),
    });
  }

  const readme = buildInstallReadme(
    {
      car: setup.car,
      track: setup.track,
      game: setup.game,
      condition: setup.condition,
      lapTime: setup.lapTime,
      author: setup.author,
      url: `https://setupsheet.app/setups/${setup.id}`,
      rigProfile: setup.rigProfile,
      fileName: setup.fileName,
    },
    {
      folderPath: guide.folderPath,
      folderNote: guide.folderNote,
      fileExtension: guide.fileExtension,
      steps: guide.steps,
    },
    exportedValues,
  );
  files.unshift({
    name: "README.txt",
    content: new TextEncoder().encode(readme),
  });

  const archive = buildZip(files);
  const archiveName = sanitizeFileName(
    `${setup.car} @ ${setup.track} — SetupSheet.zip`.replace(/[—]/g, "-"),
  );

  return new NextResponse(new Uint8Array(archive), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${archiveName}"`,
      "content-length": String(archive.length),
      // A public setup, so this is reusable -- but it reflects a row that the
      // author can edit, so keep the browser's copy short-lived.
      "cache-control": "public, max-age=0, s-maxage=300",
    },
  });
}
