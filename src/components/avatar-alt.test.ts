import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every avatar in this app is rendered beside the person's name as visible
 * text (a byline link, a comment header, a leaderboard row, a menu label), so
 * a name in `alt` makes screen readers announce each person twice -- once per
 * setup card on the browse grid. Decorative avatars take `alt=""`.
 *
 * This scans the source rather than rendering, because the duplication is a
 * property of the markup rather than of one component's behaviour, and it
 * covers dynamic branches a shallow render would miss. If an avatar is ever the
 * *only* representation of a person, give it a name and add the file to the
 * allow-list below with a reason.
 */

const ALLOW_LIST = new Set<string>([]);
const SOURCE_ROOTS = ["src/components", "src/app"];

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...collectSourceFiles(full));
    else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) files.push(full);
  }
  return files;
}

const files = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(path.join(process.cwd(), root)));

describe("avatar images are decorative", () => {
  it("scans the call sites it is meant to guard", () => {
    const withAvatars = files.filter((file) => readFileSync(file, "utf8").includes("<AvatarImage"));
    // Guards against the scanner silently matching nothing after a refactor.
    expect(withAvatars.length).toBeGreaterThanOrEqual(5);
  });

  it('uses alt="" on every AvatarImage', () => {
    const violations: string[] = [];
    let checked = 0;

    for (const file of files) {
      const relative = path.relative(process.cwd(), file);
      if (ALLOW_LIST.has(relative)) continue;

      const source = readFileSync(file, "utf8");
      for (const element of source.match(/<AvatarImage\b[\s\S]*?\/>/g) ?? []) {
        checked += 1;
        const alt = /\balt=("([^"]*)"|\{`([^`]*)`\})/.exec(element);
        if (!alt) violations.push(`${relative}: <AvatarImage> has no alt attribute`);
        else if ((alt[2] ?? alt[3] ?? "") !== "")
          violations.push(`${relative}: alt="${alt[2] ?? alt[3]}" should be "" (name is adjacent text)`);
      }
    }

    expect(checked).toBeGreaterThanOrEqual(5);
    expect(violations).toEqual([]);
  });
});
