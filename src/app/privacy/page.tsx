import type { Metadata } from "next";
import Link from "next/link";

import { SITE_URL } from "@/lib/site";

const title = "Privacy Policy";
const description = "How SetupSheet handles account, setup, telemetry, and site data.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-racing-coral">Trust & transparency</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">Effective August 28, 2026. This plain-language policy describes the current SetupSheet implementation.</p>
      </header>

      <div className="flex flex-col gap-8 leading-7 text-muted-foreground">
        <section aria-labelledby="privacy-collect">
          <h2 id="privacy-collect" className="mb-2 text-xl font-semibold text-foreground">Information we collect</h2>
          <p>When you sign in with Discord, SetupSheet receives the account information Supabase Auth makes available, such as your Discord user id, display name, avatar, and email address when provided. Your account id is used to associate your contributions with you.</p>
          <p className="mt-3">If you contribute, we store the setup metadata, tuning values, lap times, descriptions, tags, rig profile, ratings, upvotes, favorites, follows, comments, requests, notifications, proof links, and files or telemetry you choose to upload. Public setup and profile fields are visible to site visitors.</p>
        </section>

        <section aria-labelledby="privacy-use">
          <h2 id="privacy-use" className="mb-2 text-xl font-semibold text-foreground">How we use information</h2>
          <p>We use this information to authenticate contributors, publish and attribute community setups, calculate ratings and contributor statistics, provide downloads, show notifications, and protect the service from abuse. The current application does not include advertising, analytics, tracking pixels, or third-party chat widgets.</p>
        </section>

        <section aria-labelledby="privacy-services">
          <h2 id="privacy-services" className="mb-2 text-xl font-semibold text-foreground">Service providers and public content</h2>
          <p>SetupSheet uses Supabase for authentication, database, and file storage; Discord for the sign-in provider; and the hosting provider for application delivery. These providers may process technical information as described in their own policies.</p>
          <p className="mt-3">Anything you intentionally publish as a setup, comment, profile name, avatar, proof link, or contributor statistic may be publicly visible. Do not upload personal, confidential, copyrighted, or malicious material.</p>
        </section>

        <section aria-labelledby="privacy-storage">
          <h2 id="privacy-storage" className="mb-2 text-xl font-semibold text-foreground">Cookies, local storage, and retention</h2>
          <p>Supabase Auth uses secure session cookies so sign-in works. The upload form may save an in-progress draft in your browser&apos;s local storage, and the browse page may save your last-used filters. These browser values are not sent to SetupSheet until you submit an action.</p>
          <p className="mt-3">Contribution data is retained while the account or contribution remains active. The current application does not yet provide an automated self-service account deletion control; deletion requests require a manual review.</p>
        </section>

        <section id="privacy-deletion" aria-labelledby="privacy-rights">
          <h2 id="privacy-rights" className="mb-2 text-xl font-semibold text-foreground">Your choices and deletion requests</h2>
          <p>You can remove your own setups, comments, favorites, follows, and notifications through the available product controls. You can also <Link href="/account/data-deletion" className="text-racing-coral underline underline-offset-4">submit an account and data-deletion request</Link> for manual review. Do not include passwords, access tokens, private Discord information, or other sensitive data in a public issue.</p>
          <p className="mt-3">The request workflow records your request for a trusted project operator; it does not automatically delete the Supabase Auth account. If the service later operates under a formal legal entity or adds a privacy contact address, that contact should replace the repository link in this policy.</p>
        </section>

        <section aria-labelledby="privacy-children">
          <h2 id="privacy-children" className="mb-2 text-xl font-semibold text-foreground">Children and policy changes</h2>
          <p>SetupSheet is a general sim-racing community and is not directed at children. We may update this policy when the product, providers, or legal requirements change. The effective date above will be updated when the text changes.</p>
        </section>
      </div>

      <nav aria-label="Privacy navigation" className="mt-10 border-t border-border/80 pt-5 text-sm text-muted-foreground">
        <Link href="/community-guidelines" className="text-racing-coral hover:underline">Read the Community Guidelines</Link>
        <span aria-hidden="true" className="mx-2">·</span>
        <Link href="/terms" className="text-racing-coral hover:underline">Read the Terms of Use</Link>
      </nav>
    </article>
  );
}
