import type { SVGProps } from "react";

/**
 * The SetupSheet brand mark: a diagonal ribbon drawn twice -- solid, plus a
 * lighter offset duplicate behind it -- evoking a motion streak. Colored via
 * currentColor so it picks up whatever accent color it's placed in (coral,
 * in every current usage).
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <polygon points="17.5,5 17.5,10.5 3.4,19 3.4,13.7" fillOpacity="0.55" transform="translate(3.2,2.8)" />
      <polygon points="17.5,5 17.5,10.5 3.4,19 3.4,13.7" />
    </svg>
  );
}
