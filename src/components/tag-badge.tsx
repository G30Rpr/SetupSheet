import { Badge } from "@/components/ui/badge";
import type { SetupTag } from "@/lib/types";

const tagVariant: Record<SetupTag, "green" | "blue" | "red" | "amber" | "secondary"> = {
  Safe: "green",
  Beginner: "blue",
  Quali: "red",
  Race: "secondary",
  Aggressive: "amber",
  "Wet Weather": "blue",
};

export function TagBadge({ tag }: { tag: SetupTag }) {
  return <Badge variant={tagVariant[tag]}>{tag}</Badge>;
}
