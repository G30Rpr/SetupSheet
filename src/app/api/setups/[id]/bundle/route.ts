import { NextResponse } from "next/server";

import { buildInstallReadme, buildZip, type BundledFile } from "@/lib/install-bundle";
import { resolveInstallGuide } from "@/lib/install-guides";
import { buildSetupExportText, buildSetupExportFilename } from "@/lib/setup-export";
import { sanitizeFileName } from "@/lib/storage";
import { getSetupById } from "@/lib/supabase/setups";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/utils";

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "That setup id is invalid." }, { status: 400 });
  }

  const setup = await getSetupById(id);
  if (!setup) {
    return NextResponse.json({ error: "Setup not found." }, { status: 404 });
  }

  const guide = resolveInstallGuide(setup.game, setup);
  const hasValues = Boolean(setup.setupValues && Object.keys(setup.setupValues).length > 0);
  if (!setup.fileUrl && !hasValues) {
    return NextResponse.json(
      { error: "This setup has no file or values to bundle." },
      { status: 404 }
    );
  }

  const files: BundledFile[] = [];
  const setupFileName = setup.fileName
    ? sanitizeFileName(setup.fileName)
    : buildSetupExportFilename(setup, guide.fileExtension ?? ".txt");

  if (setup.fileUrl) {
    try {
      const response = await fetch(setup.fileUrl, { cache: "no-store" });
      if (response.ok) {
        files.push({
          name: setupFileName,
          content: new Uint8Array(await response.arrayBuffer()),
        });
      } else {
        logger.error("install bundle: storage fetch failed", {
          status: response.status,
          id,
        });
      }
    } catch (error) {
      // A README-only bundle still helps; the response below says what's in it.
      logger.error("install bundle: storage fetch threw", error);
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
    exportedValues
  );
  files.unshift({ name: "README.txt", content: new TextEncoder().encode(readme) });

  const archive = buildZip(files);
  const archiveName = sanitizeFileName(
    `${setup.car} @ ${setup.track} — SetupSheet.zip`.replace(/[—]/g, "-")
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
