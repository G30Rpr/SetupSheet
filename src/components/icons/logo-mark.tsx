import type { SVGProps } from "react";

/**
 * The SetupSheet brand mark: a setup sheet (clipboard) with three tuning
 * sliders inside, standing in for tire pressure / camber / ARB-style
 * adjustments — literal, not a generic flag or gauge like most sim-racing
 * setup sites use.
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <rect x="9" y="2" width="6" height="3" rx="1" />
      <line x1="7" y1="10.5" x2="17" y2="10.5" strokeWidth="1.4" />
      <circle cx="10" cy="10.5" r="1.4" fill="currentColor" stroke="none" />
      <line x1="7" y1="14.5" x2="17" y2="14.5" strokeWidth="1.4" />
      <circle cx="14.5" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
      <line x1="7" y1="18.2" x2="17" y2="18.2" strokeWidth="1.4" />
      <circle cx="12" cy="18.2" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
