"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { games, rigProfiles } from "@/lib/data";
import type { Game } from "@/lib/types";
import type { FinderCombo } from "@/lib/supabase/setups";
import { readLastRig, writeLastRig, isRigProfile } from "@/lib/last-rig";
import { cn } from "@/lib/utils";

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

/**
 * The homepage combo finder: Game -> Car -> Track -> Rig -> /setups with the
 * combination in the query string. Car and Track are typed fields with
 * suggestions from real published setups first (dependent on game / game+car)
 * and the known rosters second — free typing always works so an empty combo
 * can still be found and requested. The last chosen rig is remembered on the
 * device and preselected next visit.
 */
export function ComboFinder({ combos }: { combos: FinderCombo[] }) {
  const router = useRouter();
  const [game, setGame] = useState<string>("");
  const [car, setCar] = useState<string>("");
  const [track, setTrack] = useState<string>("");
  const [rig, setRig] = useState<string>("");
  // Rosters are stored keyed to the game they were loaded for, so a switch
  // can never leak the previous game's cars/tracks into the suggestions.
  const [rosters, setRosters] = useState<{
    game: string;
    cars: string[];
    tracks: string[];
  } | null>(null);

  // Preselect the saved rig after mount (localStorage isn't available during
  // SSR; doing it in an effect avoids a hydration mismatch).
  useEffect(() => {
    const saved = readLastRig();
    // Hydrating from localStorage on mount, not deriving from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setRig(saved);
  }, []);

  function handleRigChange(value: string) {
    setRig(value);
    writeLastRig(isRigProfile(value) ? value : null);
  }

  // Known rosters load lazily (same trade-off as the upload form) so the
  // homepage's initial JS stays small. Failures leave typed entry working.
  useEffect(() => {
    let cancelled = false;
    if (!game) return;
    Promise.all([import("@/lib/car-lists"), import("@/lib/track-lists")])
      .then(([carListsModule, trackListsModule]) => {
        if (cancelled) return;
        const flatten = (groups?: { options: string[] }[]) =>
          (groups ?? []).flatMap((group) => group.options);
        setRosters({
          game,
          cars: flatten(carListsModule.carLists[game as Game]),
          tracks: flatten(trackListsModule.trackLists[game as Game]),
        });
      })
      .catch(() => {
        // Suggestions are a nicety; the fields accept typed values regardless.
      });
    return () => {
      cancelled = true;
    };
  }, [game]);

  const carsForGame = useMemo(() => {
    if (!game) return [];
    const rosterCars = rosters?.game === game ? rosters.cars : [];
    return uniqueSorted([
      ...combos.filter((combo) => combo.game === game).map((combo) => combo.car),
      ...rosterCars,
    ]);
  }, [combos, game, rosters]);

  const tracksForSelection = useMemo(() => {
    if (!game) return [];
    const rosterTracks = rosters?.game === game ? rosters.tracks : [];
    const matches = combos.filter(
      (combo) => combo.game === game && (!car.trim() || combo.car === car.trim())
    );
    return uniqueSorted([
      ...matches.map((combo) => combo.track),
      // Fall back to everything known for the game so an unrepresented
      // car at a known track can still be typed and requested.
      ...combos.filter((combo) => combo.game === game).map((combo) => combo.track),
      ...rosterTracks,
    ]);
  }, [combos, game, car, rosters]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (game) params.set("game", game);
    if (car.trim()) params.set("car", car.trim());
    if (track.trim()) params.set("track", track.trim());
    if (rig) params.set("rig", rig);
    const query = params.toString();
    router.push(query ? `/setups?${query}` : "/setups");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-3xl rounded-2xl border border-border/80 bg-card p-5 text-left shadow-card sm:p-7"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finder-game">Game</Label>
          <Select value={game} onValueChange={setGame}>
            <SelectTrigger id="finder-game" className="w-full">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              {games.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finder-car">Car</Label>
          <Input
            id="finder-car"
            list="finder-car-options"
            value={car}
            onChange={(event) => setCar(event.target.value)}
            placeholder={game ? "e.g. BMW M4 GT3 2021" : "Pick a game first"}
            disabled={!game}
            maxLength={80}
            autoComplete="off"
          />
          <datalist id="finder-car-options">
            {carsForGame.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finder-track">Track</Label>
          <Input
            id="finder-track"
            list="finder-track-options"
            value={track}
            onChange={(event) => setTrack(event.target.value)}
            placeholder={game ? "e.g. Spa-Francorchamps" : "Pick a game first"}
            disabled={!game}
            maxLength={80}
            autoComplete="off"
          />
          <datalist id="finder-track-options">
            {tracksForSelection.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finder-rig">Rig</Label>
          <Select value={rig} onValueChange={handleRigChange}>
            <SelectTrigger id="finder-rig" className="w-full">
              <SelectValue placeholder="Select your rig" />
            </SelectTrigger>
            <SelectContent>
              {rigProfiles.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Find a setup
          <ArrowRight />
        </Button>
        <Button asChild variant="link" className={cn("w-full justify-start px-0 text-muted-foreground sm:w-auto")}>
          <Link href="/engineer">
            <Wrench className="size-4" />
            The car is misbehaving
          </Link>
        </Button>
      </div>
    </form>
  );
}
