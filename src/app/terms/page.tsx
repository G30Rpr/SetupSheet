import type { Metadata } from "next";
import Link from "next/link";

import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "Terms of Use";
const description = "The basic rules for using SetupSheet and sharing sim-racing setup files.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-racing-coral">Community service</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">Effective August 28, 2026. These terms are a practical product draft and should receive legal review before a public commercial launch.</p>
      </header>

      <div className="flex flex-col gap-8 leading-7 text-muted-foreground">
        <section aria-labelledby="terms-acceptance">
          <h2 id="terms-acceptance" className="mb-2 text-xl font-semibold text-foreground">Using {SITE_NAME}</h2>
          <p>By browsing or contributing to SetupSheet, you agree to use the service lawfully, respect other racers, and follow these terms and the <Link href="/community-guidelines" className="text-racing-coral underline underline-offset-4">Community Guidelines</Link>. You may browse public setups without an account; Discord authentication is required for contributions and account-bound actions.</p>
        </section>

        <section aria-labelledby="terms-content">
          <h2 id="terms-content" className="mb-2 text-xl font-semibold text-foreground">Your content</h2>
          <p>You are responsible for the setup files, telemetry, descriptions, links, comments, and other material you submit. You must have the right to share it and must not upload malware, personal data belonging to someone else, copyrighted material without permission, or content that violates a game publisher&apos;s rules.</p>
          <p className="mt-3">You give SetupSheet permission to store, process, display, and distribute the content as necessary to operate the service. You retain ownership of your content. You may remove your own eligible contributions using the product controls, subject to backups and legal retention requirements.</p>
        </section>

        <section aria-labelledby="terms-downloads">
          <h2 id="terms-downloads" className="mb-2 text-xl font-semibold text-foreground">Downloads and setup advice</h2>
          <p>Community setups, ratings, lap times, telemetry, and comments are user-provided. They are not guaranteed to be accurate, safe, fast, compatible with your version of a game, or suitable for your hardware. Download and use files at your own risk, scan files where appropriate, and keep backups of your own setups.</p>
        </section>

        <section aria-labelledby="terms-enforcement">
          <h2 id="terms-enforcement" className="mb-2 text-xl font-semibold text-foreground">Moderation and availability</h2>
          <p>SetupSheet may remove content, limit accounts, or suspend access when material is abusive, unsafe, unlawful, spammy, or inconsistent with these terms. The service is provided as available and may change, be interrupted, or be discontinued.</p>
        </section>

        <section aria-labelledby="terms-affiliation">
          <h2 id="terms-affiliation" className="mb-2 text-xl font-semibold text-foreground">Third-party names</h2>
          <p>SetupSheet is an independent community project. It is not affiliated with, sponsored by, or endorsed by iRacing, Assetto Corsa, Kunos Simulazioni, EA, Codemasters, Gran Turismo, Automobilista, Le Mans Ultimate, Discord, or other referenced publishers and providers.</p>
        </section>

        <section aria-labelledby="terms-contact">
          <h2 id="terms-contact" className="mb-2 text-xl font-semibold text-foreground">Questions and reports</h2>
          <p>For setup or comment reports, use the in-app report link. For account questions, deletion requests, or broader service issues, use the <a className="text-racing-coral underline underline-offset-4" href="https://github.com/G30Rpr/SetupSheet" target="_blank" rel="noopener noreferrer">SetupSheet repository</a>. Do not post private credentials or sensitive personal information publicly.</p>
        </section>
      </div>

      <nav aria-label="Terms navigation" className="mt-10 border-t border-border/80 pt-5 text-sm text-muted-foreground">
        <Link href="/privacy" className="text-racing-coral hover:underline">Read the Privacy Policy</Link>
        <span aria-hidden="true" className="mx-2">·</span>
        <Link href="/community-guidelines" className="text-racing-coral hover:underline">Read the Community Guidelines</Link>
      </nav>
    </article>
  );
}
