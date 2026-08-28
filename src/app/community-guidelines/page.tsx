import type { Metadata } from "next";
import Link from "next/link";

import { SITE_URL } from "@/lib/site";

const title = "Community Guidelines";
const description = "Guidelines for safe, useful, and respectful sim-racing contributions on SetupSheet.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/community-guidelines` },
};

export default function CommunityGuidelinesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-racing-green">Race clean</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">Help other racers find setups they can trust, understand, and safely try.</p>
      </header>

      <div className="flex flex-col gap-8 leading-7 text-muted-foreground">
        <section aria-labelledby="guidelines-share">
          <h2 id="guidelines-share" className="mb-2 text-xl font-semibold text-foreground">Share useful setup information</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use accurate game, car, track, condition, rig, and lap-time information.</li>
            <li>Explain whether a setup is intended for qualifying, racing, wet weather, beginners, or a particular driving style.</li>
            <li>Only mark or describe a setup as verified when the attached proof or telemetry genuinely supports the claim.</li>
            <li>Keep comments specific and constructive so the author can improve the setup.</li>
          </ul>
        </section>

        <section aria-labelledby="guidelines-prohibited">
          <h2 id="guidelines-prohibited" className="mb-2 text-xl font-semibold text-foreground">Do not upload or post</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Malware, harmful scripts, intentionally corrupted files, or misleading download links.</li>
            <li>Private information, passwords, access tokens, or personal data about another person.</li>
            <li>Copyrighted or publisher-owned material that you do not have permission to redistribute.</li>
            <li>Harassment, hate speech, threats, spam, impersonation, or attempts to manipulate ratings and upvotes.</li>
            <li>Content that violates a game, league, competition, or hosting provider&apos;s rules.</li>
          </ul>
        </section>

        <section aria-labelledby="guidelines-safety">
          <h2 id="guidelines-safety" className="mb-2 text-xl font-semibold text-foreground">Download safely</h2>
          <p>SetupSheet does not guarantee that community files are compatible, accurate, or safe for every machine. Keep your own backups, scan downloads when appropriate, and stop using a file if it behaves unexpectedly. Community ratings are opinions, not a safety certification.</p>
        </section>

        <section aria-labelledby="guidelines-enforcement">
          <h2 id="guidelines-enforcement" className="mb-2 text-xl font-semibold text-foreground">Moderation and reports</h2>
          <p>Content that breaks these guidelines may be removed and accounts may be limited or suspended. Use the in-app report link on a setup or comment when available. For broader service issues, contact the project through the <a className="text-racing-coral underline underline-offset-4" href="https://github.com/G30Rpr/SetupSheet" target="_blank" rel="noopener noreferrer">SetupSheet repository</a>. Do not include private credentials or sensitive personal information in a public issue.</p>
        </section>
      </div>

      <nav aria-label="Community policy navigation" className="mt-10 border-t border-border/80 pt-5 text-sm text-muted-foreground">
        <Link href="/privacy" className="text-racing-coral hover:underline">Read the Privacy Policy</Link>
        <span aria-hidden="true" className="mx-2">·</span>
        <Link href="/terms" className="text-racing-coral hover:underline">Read the Terms of Use</Link>
      </nav>
    </article>
  );
}
