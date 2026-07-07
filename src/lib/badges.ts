import type { badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeTier {
  name: string;
  threshold: number;
  variant: BadgeVariant;
}

/** Ordered highest-threshold-first so getBadgeTier can return the first match. */
export const badgeTiers: BadgeTier[] = [
  { name: "Gold Contributor", threshold: 200, variant: "amber" },
  { name: "Silver Contributor", threshold: 50, variant: "blue" },
  { name: "Bronze Contributor", threshold: 10, variant: "secondary" },
];

/** Returns the highest tier a total-upvote count qualifies for, or null below the lowest threshold. */
export function getBadgeTier(totalUpvotes: number): BadgeTier | null {
  return badgeTiers.find((tier) => totalUpvotes >= tier.threshold) ?? null;
}
