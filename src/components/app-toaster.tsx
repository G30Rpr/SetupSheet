"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Bridges next-themes' resolved theme into sonner, whose own success/error color variants differ between light and dark. */
export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--color-card)",
          color: "var(--color-foreground)",
          border: "1px solid var(--color-border)",
        },
      }}
    />
  );
}
