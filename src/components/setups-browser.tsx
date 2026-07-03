"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SetupCard } from "@/components/setup-card";
import { conditions, games, getCarsForGame, getTracksForGame } from "@/lib/data";
import type { Setup } from "@/lib/types";

const ALL = "all";

export function SetupsBrowser({ setups }: { setups: Setup[] }) {
  const [game, setGame] = useState<string>(ALL);
  const [car, setCar] = useState<string>(ALL);
  const [track, setTrack] = useState<string>(ALL);
  const [condition, setCondition] = useState<string>(ALL);

  const carOptions = useMemo(
    () => getCarsForGame(setups, game === ALL ? undefined : game),
    [setups, game]
  );
  const trackOptions = useMemo(
    () => getTracksForGame(setups, game === ALL ? undefined : game),
    [setups, game]
  );

  const filtered = useMemo(() => {
    return setups.filter((s) => {
      if (game !== ALL && s.game !== game) return false;
      if (car !== ALL && s.car !== car) return false;
      if (track !== ALL && s.track !== track) return false;
      if (condition !== ALL && s.condition !== condition) return false;
      return true;
    });
  }, [setups, game, car, track, condition]);

  const hasActiveFilters =
    game !== ALL || car !== ALL || track !== ALL || condition !== ALL;

  function resetFilters() {
    setGame(ALL);
    setCar(ALL);
    setTrack(ALL);
    setCondition(ALL);
  }

  function handleGameChange(value: string) {
    setGame(value);
    setCar(ALL);
    setTrack(ALL);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="size-4" />
          Filter setups
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FilterSelect
            label="Game"
            value={game}
            onChange={handleGameChange}
            options={games}
            placeholder="All games"
          />
          <FilterSelect
            label="Car"
            value={car}
            onChange={setCar}
            options={carOptions}
            placeholder="All cars"
          />
          <FilterSelect
            label="Track"
            value={track}
            onChange={setTrack}
            options={trackOptions}
            placeholder="All tracks"
          />
          <FilterSelect
            label="Condition"
            value={condition}
            onChange={setCondition}
            options={conditions}
            placeholder="All conditions"
          />
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X />
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "setup" : "setups"} found
        </p>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((setup) => (
            <SetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      ) : setups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 py-16 text-center">
          <p className="font-medium">No setups yet</p>
          <p className="text-sm text-muted-foreground">
            Be the first to share one with the community.
          </p>
          <Button asChild size="sm">
            <Link href="/upload">Upload Your Setup</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 py-16 text-center">
          <p className="font-medium">No setups match your filters</p>
          <p className="text-sm text-muted-foreground">
            Try clearing a filter or check back soon — new setups are added every day.
          </p>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
