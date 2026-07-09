"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type SortOption = "newest" | "trending" | "mostDownloaded" | "safest" | "fastest";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "trending", label: "Trending" },
  { value: "mostDownloaded", label: "Most Downloaded" },
  { value: "safest", label: "Safest" },
  { value: "fastest", label: "Fastest" },
];

/** Parses an "M:SS.mmm" lap time into total seconds; unparseable/blank times sort last. */
function lapTimeSeconds(lapTime: string): number {
  const match = lapTime.trim().match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return Infinity;
  const [, minutes, seconds] = match;
  return Number(minutes) * 60 + Number(seconds);
}

const SORT_VALUES = sortOptions.map((option) => option.value);

export function SetupsBrowser({ setups }: { setups: Setup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [game, setGame] = useState<string>(() => searchParams.get("game") ?? ALL);
  const [car, setCar] = useState<string>(() => searchParams.get("car") ?? ALL);
  const [track, setTrack] = useState<string>(() => searchParams.get("track") ?? ALL);
  const [condition, setCondition] = useState<string>(() => searchParams.get("condition") ?? ALL);
  const [sort, setSort] = useState<SortOption>(() => {
    const fromUrl = searchParams.get("sort");
    return (SORT_VALUES as string[]).includes(fromUrl ?? "") ? (fromUrl as SortOption) : "newest";
  });

  /**
   * Keeps the URL in sync so a filtered view can be shared, bookmarked, or
   * survive a refresh -- debounced on the text input so typing a search
   * query doesn't rewrite the URL on every keystroke. Uses replace (not
   * push) so adjusting filters doesn't spam browser history.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (game !== ALL) params.set("game", game);
      if (car !== ALL) params.set("car", car);
      if (track !== ALL) params.set("track", track);
      if (condition !== ALL) params.set("condition", condition);
      if (sort !== "newest") params.set("sort", sort);

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 300);

    return () => clearTimeout(id);
  }, [search, game, car, track, condition, sort, pathname, router]);

  const carOptions = useMemo(
    () => getCarsForGame(setups, game === ALL ? undefined : game),
    [setups, game]
  );
  const trackOptions = useMemo(
    () => getTracksForGame(setups, game === ALL ? undefined : game),
    [setups, game]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const results = setups.filter((s) => {
      if (game !== ALL && s.game !== game) return false;
      if (car !== ALL && s.car !== car) return false;
      if (track !== ALL && s.track !== track) return false;
      if (condition !== ALL && s.condition !== condition) return false;
      if (query) {
        const haystack = [s.game, s.car, s.track, s.author, s.description, ...s.tags]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    switch (sort) {
      case "trending":
        return [...results].sort((a, b) => b.upvotes - a.upvotes);
      case "mostDownloaded":
        return [...results].sort((a, b) => b.downloads - a.downloads);
      case "safest":
        return [...results].sort((a, b) => b.predictability - a.predictability);
      case "fastest":
        return [...results].sort(
          (a, b) => lapTimeSeconds(a.lapTime) - lapTimeSeconds(b.lapTime)
        );
      default:
        return results;
    }
  }, [setups, search, game, car, track, condition, sort]);

  const hasActiveFilters =
    search !== "" || game !== ALL || car !== ALL || track !== ALL || condition !== ALL;

  function resetFilters() {
    setSearch("");
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
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by car, track, game, or tag..."
            className="pl-9"
            aria-label="Search setups"
          />
        </div>

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

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "setup" : "setups"} found
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-xs font-medium text-muted-foreground">
            Sort by
          </label>
          <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
            <SelectTrigger id="sort" size="sm" className="w-[175px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
