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

/** Upload through the authenticated Supabase Edge gateway. Keeping the binary
 * outside Vercel preserves the 5/10 MiB limits without exposing a provider
 * capability that could outlive cleanup. The ticket is owner-bound and one-use. */
export async function uploadFileDirectly(
  kind: UploadKind,
  file: File,
  userId: string | null,
  onProgress?: UploadProgressHandler,
): Promise<DirectUploadResult> {
  const localCheck = describeUploadTarget(
    kind,
    file.name,
    file.size,
    userId ?? "",
  );
  if (!localCheck.target || !userId) {
    return {
      path: null,
      fileName: null,
      error: localCheck.error ?? "You need to be signed in.",
    };
  }

  const signatureError = await validateFileSignature(
    file,
    localCheck.target.fileName
      .slice(localCheck.target.fileName.lastIndexOf("."))
      .toLowerCase(),
  );
  if (signatureError)
    return { path: null, fileName: null, error: signatureError };

  const target = await createUploadTarget(kind, file.name, file.size);
  if (target.error || !target.path || !target.token) {
    return {
      path: null,
      fileName: null,
      error: target.error ?? "Couldn't start the upload.",
    };
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const backend = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!session?.access_token || !backend)
    return { path: null, fileName: null, error: "Sign in to upload." };
  onProgress?.(0);
  try {
    const response = await fetch(
      new URL("/functions/v1/storage-upload", backend),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          "Content-Type": "application/octet-stream",
          "x-upload-ticket": target.token,
        },
        body: file,
        signal: AbortSignal.timeout(145_000),
      },
    );
    if (!response.ok) throw new Error("Upload gateway rejected the request");
    onProgress?.(100);
  } catch {
    logger.warn(
      "uploadFileDirectly: upload gateway did not confirm completion",
    );
    return {
      path: null,
      fileName: null,
      error: "Upload failed. Check your connection and try again.",
    };
  }

  const verified = await verifyUploadedFile(kind, target.path, target.fileName);
  if (verified.error || !verified.path) {
    return {
      path: null,
      fileName: null,
      error: verified.error ?? "Upload failed.",
    };
  }

  return { path: verified.path, fileName: verified.fileName, error: null };
}
