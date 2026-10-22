import type { Metadata } from "next";

import { EngineerClient } from "@/components/engineer/engineer-client";
import { getSetups } from "@/lib/supabase/setups";
import { fullPageTitle } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "Setup Engineer";
const socialTitle = fullPageTitle(title);
const description = "Describe a sim-racing setup symptom and get a ranked, static test plan for ACC and Le Mans Ultimate.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/engineer` },
  openGraph: {
    title: socialTitle,
    description,
    url: "/engineer",
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary_large_image", title: socialTitle, description },
};

export default async function EngineerPage() {
  // The loop's setup candidates come from the same browse index the grid
  // uses; a failed read simply hides the matches section (EngineerClient).
  const { setups } = await getSetups();
  return <EngineerClient setups={setups} />;
}
