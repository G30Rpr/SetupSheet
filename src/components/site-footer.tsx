import Link from "next/link";
import { FlagTriangleRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
            <FlagTriangleRight className="size-3.5" />
          </span>
          <span className="font-semibold tracking-tight">
            Setup<span className="text-racing-green">Sheet</span>
          </span>
          <span className="ml-2 text-sm text-muted-foreground">
            Free setups, by the community.
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <Link href="/setups" className="hover:text-foreground transition-colors">
            Browse Setups
          </Link>
          <Link href="/upload" className="hover:text-foreground transition-colors">
            Upload
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} SetupSheet. Not affiliated with any sim title publisher.
        </p>
      </div>
    </footer>
  );
}
