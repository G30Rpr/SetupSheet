import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-racing-red/15 text-red-400 ring-1 ring-inset ring-racing-red/30">
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="text-xl font-semibold">Sign-in failed</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t complete your Discord sign-in. The link may have
        expired — please try again.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
