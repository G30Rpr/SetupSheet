import { Badge } from "@/components/ui/badge";
import type { SetupTag } from "@/lib/types";

export function TagBadge({ tag }: { tag: SetupTag }) {
  return <Badge variant="secondary">{tag}</Badge>;
}
