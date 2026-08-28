import Link from "next/link";

import { LogoMark } from "@/components/icons/logo-mark";
import { navLinks } from "@/lib/nav-links";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/30">
            <LogoMark className="size-3.5" />
          </span>
          <span className="font-semibold tracking-tight">
            Setup<span className="text-racing-coral">Sheet</span>
          </span>
          <span className="ml-2 text-sm text-muted-foreground">
            Free setups, by the community.
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground transition-colors">
              {link.label}
            </Link>
          ))}
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/community-guidelines" className="hover:text-foreground transition-colors">
            Guidelines
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} SetupSheet. Not affiliated with any sim title publisher.
        </p>
      </div>
    </footer>
  );
}
