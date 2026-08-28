import type { Metadata } from "next";

import { UploadForm } from "@/components/upload-form";
import { fullPageTitle } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "Upload a Setup";
const socialTitle = fullPageTitle(title);
const description = "Share your sim racing setup with the community in under a minute.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/upload` },
  openGraph: { title: socialTitle, description, url: "/upload", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: socialTitle, description },
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
