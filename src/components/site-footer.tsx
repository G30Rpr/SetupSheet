import Link from "next/link";

import { LogoMark } from "@/components/icons/logo-mark";
import { navLinks } from "@/lib/nav-links";
import {
  getContributorCount,
  LEADERBOARD_MIN_CONTRIBUTORS,
} from "@/lib/supabase/leaderboard";

export async function SiteFooter() {
  // Leaderboard is footer-only (P3) and hidden until enough people have
  // shared (P1). Any failure reads as 0, so the link fails closed and the
  // footer — which renders on every page — can never break one.
  let contributorCount = 0;
  try {
    contributorCount = await getContributorCount();
  } catch {
    contributorCount = 0;
  }
  const showLeaderboard = contributorCount >= LEADERBOARD_MIN_CONTRIBUTORS;

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
            Free setups, matched to your rig.
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground ">
              {link.label}
            </Link>
          ))}
          {showLeaderboard && (
            <Link href="/leaderboard" className="hover:text-foreground ">
              Leaderboard
            </Link>
          )}
          <Link href="/privacy" className="hover:text-foreground ">
            Privacy
          </Link>
          <Link href="/community-guidelines" className="hover:text-foreground ">
            Guidelines
          </Link>
          <Link href="/terms" className="hover:text-foreground ">
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
