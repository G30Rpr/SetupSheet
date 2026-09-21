import { createClient } from "@/lib/supabase/client";
import { validateFileSignature } from "@/lib/file-validation";
import { describeUploadTarget, type UploadKind } from "@/lib/upload-targets";
import { createUploadTarget, verifyUploadedFile } from "@/lib/actions/setups";
import { logger } from "@/lib/logger";

export interface DirectUploadResult {
  path: string | null;
  fileName: string | null;
  error: string | null;
}

export type UploadProgressHandler = (percent: number) => void;

/**
 * Uploads a file straight from the browser to Supabase Storage, using a
 * short-lived signed URL minted by the Server Action.
 *
 * The bytes never touch the Next.js server, which is what makes the 5 MB
 * setup / 10 MB telemetry limits actually reachable (the Server Action body
 * limit is 1 MB and Vercel's function request ceiling is ~4.5 MB).
 *
 * Order of operations is deliberate: cheap local checks first (extension,
 * size, content signature), then the signed URL, then the binary, then a
 * server-side re-verification of what actually landed. Each step fails with a
 * message the user can act on.
 */
export async function uploadFileDirectly(
  kind: UploadKind,
  file: File,
  userId: string | null,
  onProgress?: UploadProgressHandler
): Promise<DirectUploadResult> {
  const localCheck = describeUploadTarget(kind, file.name, file.size, userId ?? "");
  if (!localCheck.target || !userId) {
    return { path: null, fileName: null, error: localCheck.error ?? "You need to be signed in." };
  }

  const signatureError = await validateFileSignature(file, localCheck.target.fileName.slice(
    localCheck.target.fileName.lastIndexOf(".")
  ).toLowerCase());
  if (signatureError) return { path: null, fileName: null, error: signatureError };

  const target = await createUploadTarget(kind, file.name, file.size);
  if (target.error || !target.path || !target.token) {
    return { path: null, fileName: null, error: target.error ?? "Couldn't start the upload." };
  }

  const supabase = createClient();
  // `x-upsert: false` so a path collision (which would mean a UUID collision)
  // surfaces as an error instead of silently overwriting another object.
  const upload = supabase.storage
    .from("setup-files")
    .uploadToSignedUrl(target.path, target.token, file, { upsert: false });

  if (onProgress) {
    // supabase-js exposes no upload progress callback over fetch, so this
    // reports "in flight" rather than a byte count: a determinate bar would
    // be a lie. It exists so a slow 10 MB telemetry pack shows visible
    // movement instead of a frozen button.
    onProgress(0);
    const uploadWithProgress = upload.then((result) => {
      onProgress(100);
      return result;
    });
    void uploadWithProgress.catch(() => undefined);
  } else {
    void upload.catch(() => undefined);
  }

  const { error: uploadError } = await upload;
  if (uploadError) {
    logger.error("uploadFileDirectly: storage upload failed", uploadError);
    return {
      path: null,
      fileName: null,
      error: "Upload failed. Check your connection and try again.",
    };
  }

  const verified = await verifyUploadedFile(kind, target.path, target.fileName);
  if (verified.error || !verified.path) {
    return { path: null, fileName: null, error: verified.error ?? "Upload failed." };
  }

  return { path: verified.path, fileName: verified.fileName, error: null };
}
