import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Browse-card marker for a setup built on the same steering and brake
 * hardware as your rig (saved profile, or the rig remembered on this
 * device). Hardware match only -- it is not a rating and not a
 * recommendation.
 */
export function RigMatchChip() {
  return (
    <Badge
      variant="secondary"
      className="text-racing-cyan"
      title="Same steering and brake hardware as your rig. Not a rating."
    >
      <SlidersHorizontal aria-hidden="true" />
      Matches your rig
    </Badge>
  );
}
