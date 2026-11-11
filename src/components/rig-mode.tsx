"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ClipboardCopy, Copy, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setupSchemas } from "@/lib/setup-schemas";
import type { Setup } from "@/lib/types";

type RigSetup = Pick<Setup, "id" | "game" | "car" | "track" | "condition" | "rigProfile" | "setupValues">;

export function RigMode({ setup }: { setup: RigSetup }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [keepAwake, setKeepAwake] = useState(false);
  const [wakeSupported, setWakeSupported] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const groups = useMemo(() => {
    const values = setup.setupValues ?? {};
    const known = new Set<string>();
    const mapped = setupSchemas[setup.game].map((group) => ({
      title: group.title,
      fields: group.fields.flatMap((field) => {
        const value = values[field.key];
        if (value === undefined || value === null || value === "") return [];
        known.add(field.key);
        return [{ key: field.key, label: field.label, value }];
      }),
    })).filter((group) => group.fields.length > 0);
    const other = Object.entries(values)
      .filter(([key, value]) => !known.has(key) && value !== "")
      .map(([key, value]) => ({ key, label: key.replace(/([a-z])([A-Z])/g, "$1 $2"), value }));
    if (other.length > 0) mapped.push({ title: "Additional values", fields: other });
    return mapped;
  }, [setup.game, setup.setupValues]);

  const hasValues = groups.length > 0;

  useEffect(() => {
    setWakeSupported("wakeLock" in navigator);
  }, []);

  useEffect(() => {
    if (!keepAwake || !("wakeLock" in navigator)) return;
    let cancelled = false;
    async function acquire() {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await next.release();
          return;
        }
        wakeLockRef.current = next;
      } catch {
        if (!cancelled) {
          setKeepAwake(false);
          toast.error("Screen wake lock is unavailable on this device.");
        }
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void acquire();
    }
    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [keepAwake]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Unable to copy. Select the text instead.");
    }
  }

  const allValues = groups.flatMap((group) => [
    group.title,
    ...group.fields.map((field) => `${field.label}: ${field.value}`),
    "",
  ]).join("\n").trim();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background text-foreground">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/setups/${encodeURIComponent(setup.id)}`}>
              <ArrowLeft aria-hidden="true" /> Exit rig mode
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {wakeSupported && (
              <Button variant={keepAwake ? "secondary" : "outline"} size="sm" type="button" aria-pressed={keepAwake} onClick={() => setKeepAwake((value) => !value)}>
                {keepAwake ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                {keepAwake ? "Screen stays awake" : "Keep screen awake"}
              </Button>
            )}
            {hasValues && (
              <Button type="button" size="sm" onClick={() => void copy(allValues, "all")}>
                {copiedField === "all" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                Copy all values
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-racing-coral">Rig mode · Setup values</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">{setup.car}</h1>
        <p className="mt-2 text-base text-muted-foreground">{setup.track} · {setup.game} · {setup.condition}</p>
        <p className="mt-2 text-sm text-muted-foreground">Shared for: {setup.rigProfile}. Values are provided by the uploader.</p>

        {hasValues ? (
          <div className="mt-8 space-y-8">
            {groups.map((group) => (
              <section key={group.title} aria-label={group.title} className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 className="border-b border-border bg-secondary/40 px-4 py-3 text-sm font-semibold uppercase tracking-wide sm:px-6">{group.title}</h2>
                <dl className="divide-y divide-border/80">
                  {group.fields.map((field) => (
                    <div key={field.key} className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-6">
                      <dt className="min-w-0 flex-1 text-sm font-medium sm:text-base">{field.label}</dt>
                      <dd className="min-w-0 max-w-[45%] break-words text-right font-mono text-lg font-semibold tabular-nums sm:text-xl">{field.value}</dd>
                      <Button variant="outline" size="icon" className="shrink-0" type="button"
                        aria-label={`Copy ${field.label}`} onClick={() => void copy(field.value, field.key)}>
                        {copiedField === field.key ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
                      </Button>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-border px-5 py-10 text-center">
            <h2 className="text-lg font-semibold">No individual setup values attached</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">This submission may contain an importable setup file instead of manually entered values. Return to the detail page to download the file and view the installation steps.</p>
            <Button asChild variant="outline" className="mt-5">
              <Link href={`/setups/${encodeURIComponent(setup.id)}`}>View download and install options</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
