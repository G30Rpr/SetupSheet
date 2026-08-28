import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UploadForm } from "@/components/upload-form";
import { getSetupById } from "@/lib/supabase/setups";

export const metadata: Metadata = {
  title: "Edit Setup",
  description: "Update a SetupSheet community setup.",
  // Already disallowed in robots.ts -- an edit form is never meant to be
  // indexed or unfurled as a social-share preview.
  robots: { index: false, follow: false },
};

export default async function EditSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setup = await getSetupById(id);

  if (!setup || !setup.isOwner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="items-center gap-4 border-racing-red/30 px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-racing-red/15 text-racing-red ring-1 ring-inset ring-racing-red/30">
            <AlertCircle className="size-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">
              {setup ? "You can only edit your own setups" : "Setup not found"}
            </h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {setup
                ? "This setup belongs to someone else, so there's nothing to edit here."
                : "This setup may have been deleted or the link is incorrect."}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/setups">Back to Browse Setups</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Edit Your Setup
        </h1>
        <p className="mt-2 text-muted-foreground">
          Update the details below. Pace and Predictability are rated by the
          community from the setup card, not here.
        </p>
      </div>

      <UploadForm existingSetup={setup} />
    </div>
  );
}
