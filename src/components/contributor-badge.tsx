import { Award } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getBadgeTier } from "@/lib/badges";

/** Renders nothing below the lowest badge threshold -- most users start with no badge. */
export function ContributorBadge({ totalUpvotes }: { totalUpvotes: number }) {
  const tier = getBadgeTier(totalUpvotes);
  if (!tier) return null;

  return (
    <Badge variant={tier.variant}>
      <Award className="size-3" />
      {tier.name}
    </Badge>
  );
}
