import { Badge } from "@/components/ui/badge";
import {
  GAME_VERSION_STALE_HINT,
  gameVersionState,
} from "@/lib/game-version";

/**
 * The setup's reported game patch on the detail page. Renders nothing when
 * the author reported no version (never invent one); calls a setup stale
 * only when the game's operator-maintained current patch is known and
 * differs. Plain text and one outline badge — the copy carries the meaning.
 */
export function GameVersionBadge({
  gameVersion,
  currentVersion,
}: {
  gameVersion: string | null | undefined;
  currentVersion: string | null | undefined;
}) {
  const state = gameVersionState(gameVersion, currentVersion);

  if (state.kind === "unreported") return null;

  return (
    <p className="mt-2 text-sm text-muted-foreground">
      {state.kind === "stale" ? (
        <Badge
          variant="outline"
          title={GAME_VERSION_STALE_HINT}
          data-testid="game-version-stale"
        >
          Built for {state.version} — current patch is {state.currentVersion}
        </Badge>
      ) : (
        <span data-testid="game-version">
          Built for {state.version}
          {state.kind === "current" ? " · current patch" : ""}
        </span>
      )}
    </p>
  );
}
