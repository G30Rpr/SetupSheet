import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Download, HelpCircle, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fullPageTitle } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "Help & Getting Started";
const description = "Find, download, install and share community sim racing setups on SetupSheet.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/help` },
  openGraph: { title: fullPageTitle(title), description, url: "/help", siteName: SITE_NAME, type: "website" },
};

const steps = [
  { title: "Find a setup", description: "Search by simulator, car and track. Narrow the results with conditions and uploader rig filters.", icon: Search },
  { title: "Review and download", description: "Check the setup context, rating evidence and hardware fit. Browsing and downloading do not require an account.", icon: Download },
  { title: "Install or enter values", description: "Open a setup detail page for game-specific installation guidance. Use Rig mode for larger values on a phone or second screen; some games accept setup files, while others need manual entry.", icon: Upload },
];

const questions = [
  { q: "Do I need an account?", a: "No account is needed to browse or download public setups. Sign in with Discord to upload and use account-related community features." },
  { q: "What does 'Lap evidence attached' mean?", a: "The uploader added a lap video or telemetry file. This is author-supplied evidence, not independent verification by SetupSheet." },
  { q: "What is the difference between Uploader rig and My hardware?", a: "Uploader rig limits which submissions you see. My hardware highlights compatible hardware and informs the Best for my rig sort without hiding other setups." },
  { q: "How do I install a downloaded setup?", a: "Open the setup detail and follow its game-specific installation instructions. Importable files and manual-entry setups use different steps." },
  { q: "Can I use a phone beside my sim rig?", a: "Yes. Open a setup detail and choose Open rig mode for large tuning values and one-tap copying. On supported devices, Keep screen awake prevents the display from sleeping while you work." },
  { q: "What if I cannot find my car and track?", a: "You can ask the community for a missing combination on the Requests page. You can also use Engineer for general tuning guidance." },
  { q: "Are setup ratings and lap times official?", a: "Lap times are self-reported. Community pace and predictability scores reflect user ratings, and low rating counts provide limited evidence." },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-racing-coral">Getting started</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Help using SetupSheet</h1>
        <p className="mt-3 text-muted-foreground">A simple route from finding a setup to using it on track. SetupSheet is a free community library, so context matters as much as the numbers.</p>
      </div>
      <section aria-labelledby="steps-heading" className="mb-12">
        <h2 id="steps-heading" className="mb-4 text-xl font-semibold tracking-tight">Find → Review → Drive</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <Card as="article" key={step.title} className="gap-3 px-5 py-5">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-secondary"><Icon className="size-4" aria-hidden="true" /></span>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </Card>
            );
          })}
        </div>
        <Button asChild className="mt-5">
          <Link href="/setups">Browse setups <ArrowRight aria-hidden="true" /></Link>
        </Button>
      </section>
      <section aria-labelledby="faq-heading" className="mb-12 max-w-3xl">
        <h2 id="faq-heading" className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
          <HelpCircle className="size-5" aria-hidden="true" /> Common questions
        </h2>
        <dl className="divide-y divide-border rounded-xl border border-border/80 bg-card px-5">
          {questions.map(({ q, a }) => (
            <div key={q} className="py-4">
              <dt className="font-medium">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="next-heading" className="rounded-xl border border-border/80 bg-secondary/40 p-5 sm:p-6">
        <h2 id="next-heading" className="text-lg font-semibold">Still looking for something?</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Ask for a missing setup, share your own with other drivers, or review the community guidelines.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link href="/requests">Request a setup</Link></Button>
          <Button asChild variant="outline"><Link href="/upload">Share a setup</Link></Button>
          <Button asChild variant="ghost"><Link href="/community-guidelines">Community guidelines</Link></Button>
        </div>
      </section>
    </div>
  );
}
