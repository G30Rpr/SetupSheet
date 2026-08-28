import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <Card className="w-full items-center gap-4 border-racing-coral/30 px-6 py-14">
        <span className="flex size-14 items-center justify-center rounded-full bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/30">
          <SearchX className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The page you are looking for may have moved or no longer exists.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/setups">Browse Setups</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
