import type { Metadata } from "next";

import { UploadForm } from "@/components/upload-form";

export const metadata: Metadata = {
  title: "Upload a Setup — SetupSheet",
  description: "Share your sim racing setup with the community in under a minute.",
};

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Upload Your Setup
        </h1>
        <p className="mt-2 text-muted-foreground">
          Drop your setup file below and fill in a few details. It only takes
          a minute, and it&apos;s always free.
        </p>
      </div>

      <UploadForm />
    </div>
  );
}
