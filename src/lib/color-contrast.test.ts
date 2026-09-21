import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG 2.2 AA contrast guards for the theme tokens in `src/app/globals.css`.
 *
 * These assertions read the real stylesheet rather than a copy of its values,
 * so a token edit that quietly drops a pairing below AA fails here instead of
 * shipping. Only pairs the code actually renders are asserted -- which is why
 * the surfaces are named for their roles (page/card/hover) and not "muted":
 * `bg-muted` is never used as a text background in this app, while
 * `bg-accent` is (dropdown and menu row hovers).
 */

const CSS_PATH = path.join(process.cwd(), "src", "app", "globals.css");

/** OKLCH -> linear sRGB, clamped to the displayable gamut. */
function oklchToLinearSrgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: Token, bg: Token): number {
  const l1 = relativeLuminance(oklchToLinearSrgb(...fg));
  const l2 = relativeLuminance(oklchToLinearSrgb(...bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

type Token = [L: number, C: number, h: number];

const OKLCH_PATTERN = /--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;

function parseThemeTokens(css: string, selector: RegExp): Record<string, Token> {
  const match = selector.exec(css);
  if (!match) throw new Error(`Could not find theme block for ${selector}`);

  // Grab the block body: from the opening brace to the first balanced close.
  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let index = bodyStart;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") depth -= 1;
    index += 1;
  }
  const body = css.slice(bodyStart, index - 1);

  const tokens: Record<string, Token> = {};
  for (const [, name, L, C, h] of body.matchAll(OKLCH_PATTERN)) {
    tokens[name] = [Number(L), Number(C), Number(h)];
  }
  return tokens;
}

const css = readFileSync(CSS_PATH, "utf8");
// The dark palette is declared for `:root` and `.dark` together.
const dark = parseThemeTokens(css, /:root,\s*\.dark\s*\{/);
const light = parseThemeTokens(css, /\.light\s*\{/);

/** Surfaces that text is actually painted on, per theme. */
const DARK_SURFACES = ["background", "card", "secondary", "accent"] as const;
const LIGHT_SURFACES = ["background", "card", "secondary", "accent"] as const;

/** Tokens used as text colour somewhere in the app, with their usage counts at audit time. */
const TEXT_TOKENS = [
  "foreground",
  "muted-foreground",
  "racing-red",
  "racing-green",
  "racing-amber",
  "racing-coral",
  "racing-cyan",
  "destructive",
  "primary",
] as const;

describe("theme token contrast (WCAG 2.2 AA)", () => {
  describe.each([
    ["dark", dark, DARK_SURFACES],
    ["light", light, LIGHT_SURFACES],
  ])("%s theme", (themeName, tokens, surfaces) => {
    it("parses every expected token from globals.css", () => {
      for (const token of [...TEXT_TOKENS, ...surfaces, "ring", "primary-foreground"]) {
        expect(tokens[token], `${themeName} --${token} not found in globals.css`).toBeDefined();
      }
    });

    it.each(TEXT_TOKENS)(
      "renders --%s text at >= 4.5:1 on every surface it is drawn on",
      (token) => {
        for (const surface of surfaces) {
          const ratio = contrastRatio(tokens[token], tokens[surface]);
          expect(
            ratio,
            `${themeName}: --${token} on --${surface} is ${ratio.toFixed(2)}:1`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    );

    it("renders the primary button label at >= 4.5:1 on the primary fill", () => {
      const ratio = contrastRatio(tokens["primary-foreground"], tokens.primary);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("renders the solid red badge label at >= 4.5:1 on the red fill", () => {
      const ratio = contrastRatio(tokens["racing-red-foreground"], tokens["racing-red"]);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("keeps the destructive button label at >= 4.5:1 on the destructive fill", () => {
      const ratio = contrastRatio(tokens["destructive-foreground"], tokens.destructive);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("keeps the focus ring at >= 3:1 against every surface it can outline (SC 1.4.11)", () => {
      for (const surface of surfaces) {
        const ratio = contrastRatio(tokens.ring, tokens[surface]);
        expect(
          ratio,
          `${themeName}: focus ring on --${surface} is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it("does not rely on alpha for the focus ring", () => {
      // A translucent ring was the original defect: it composited to 1.56:1 in
      // light mode even though the token itself looked fine in isolation.
      expect(tokens.ring).toBeDefined();
      const block = css.slice(css.indexOf(themeName === "dark" ? ":root," : ".light {"));
      const ringDeclaration = block.match(/--ring:\s*oklch\([^)]*\)/)?.[0] ?? "";
      expect(ringDeclaration).not.toContain("/");
    });
  });
});
