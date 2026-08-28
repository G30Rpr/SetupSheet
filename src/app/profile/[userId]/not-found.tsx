import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ProfileNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Card className="items-center gap-4 border-racing-red/30 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-racing-red/15 text-racing-red ring-1 ring-inset ring-racing-red/30">
          <AlertCircle className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Profile not found</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            This user may not exist, or the link is incorrect.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/leaderboard">Back to Leaderboard</Link>
        </Button>
      </Card>
    </div>
  );
}
