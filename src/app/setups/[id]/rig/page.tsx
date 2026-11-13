import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { RigMode } from "@/components/rig-mode";
import { getSetupById } from "@/lib/supabase/setups";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Rig Mode",
  description: "Read and copy shared sim racing setup values on a second screen.",
  robots: { index: false, follow: false },
};

export default async function SetupRigModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let setup: Awaited<ReturnType<typeof getSetupById>>;
  try {
    setup = await getSetupById(id);
  } catch {
    return (
      <section role="alert" className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-bold">Setup temporarily unavailable</h1>
        <p className="mt-3 text-muted-foreground">We couldn&apos;t load this setup right now.</p>
        <Link className="mt-4 inline-block underline underline-offset-4" href="/setups">
          Back to Browse Setups
        </Link>
      </section>
    );
  }

  if (!setup) notFound();
  return <RigMode setup={setup} />;
}
