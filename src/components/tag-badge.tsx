import { Badge } from "@/components/ui/badge";
import type { SetupTag } from "@/lib/types";

export function TagBadge({ tag }: { tag: SetupTag }) {
  const session = tag === "Race" || tag === "Quali";
  const category = session ? "Session" : tag === "Beginner" ? "Experience" : tag === "Wet Weather" ? "Conditions" : "Handling";
  return <Badge variant={session ? "outline" : "secondary"} title={`${category}: ${tag}`} className={session ? "font-semibold" : "font-normal"}>{tag}</Badge>;
}
