"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { GitCompare, Search, SearchX, SlidersHorizontal, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SetupCard } from "@/components/setup-card";
import { conditions, games, getCarsForGame, getTracksForGame, rigProfiles } from "@/lib/data";
import { ALL, filterAndSortSetups, type SortOption } from "@/lib/filter-setups";
import type { Setup } from "@/lib/types";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "trending", label: "Trending" },
  { value: "mostDownloaded", label: "Most Downloaded" },
  { value: "safest", label: "Safest" },
  { value: "fastest", label: "Fastest" },
];

const SORT_VALUES = sortOptions.map((option) => option.value);

// Caps how many SetupCards (each with its own lazy-loaded panels) mount at
// once -- without this, a large/filtered-open result set renders every
// match in one giant grid.
const PAGE_SIZE = 24;

export function SetupsBrowser({ setups }: { setups: Setup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [game, setGame] = useState<string>(() => searchParams.get("game") ?? ALL);
  const [car, setCar] = useState<string>(() => searchParams.get("car") ?? ALL);
  const [track, setTrack] = useState<string>(() => searchParams.get("track") ?? ALL);
  const [condition, setCondition] = useState<string>(() => searchParams.get("condition") ?? ALL);
  const [rig, setRig] = useState<string>(() => searchParams.get("rig") ?? ALL);
  const [sort, setSort] = useState<SortOption>(() => {
    const fromUrl = searchParams.get("sort");
    return (SORT_VALUES as string[]).includes(fromUrl ?? "") ? (fromUrl as SortOption) : "newest";
  });
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [page, setPage] = useState(() => {
    const fromUrl = Number(searchParams.get("page"));
    return Number.isInteger(fromUrl) && fromUrl > 1 ? fromUrl : 1;
  });

  function toggleCompareSelect(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((existing) => existing !== id);
      // Cap at 2 -- picking a third swaps out the first one picked rather
      // than doing nothing, so the checkboxes always reflect the two most
      // recently clicked.
      return prev.length >= 2 ? [prev[1], id] : [...prev, id];
    });
  }

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
      if (rig !== ALL) params.set("rig", rig);
      if (sort !== "newest") params.set("sort", sort);
      if (page > 1) params.set("page", String(page));

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 300);

    return () => clearTimeout(id);
  }, [search, game, car, track, condition, rig, sort, page, pathname, router]);

  // Jump back to page 1 whenever a filter/search/sort actually changes --
  // skipped on mount so restoring ?page=N from a shared/bookmarked URL
  // doesn't immediately reset itself.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
  }, [search, game, car, track, condition, rig, sort]);

  const carOptions = useMemo(
    () => getCarsForGame(setups, game === ALL ? undefined : game),
    [setups, game]
  );
  const trackOptions = useMemo(
    () => getTracksForGame(setups, game === ALL ? undefined : game),
    [setups, game]
  );

  const filtered = useMemo(
    () => filterAndSortSetups(setups, { search, game, car, track, condition, rig }, sort),
    [setups, search, game, car, track, condition, rig, sort]
  );

  const visibleSetups = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = filtered.length > visibleSetups.length;

  const hasActiveFilters =
    search !== "" || game !== ALL || car !== ALL || track !== ALL || condition !== ALL || rig !== ALL;

  function resetFilters() {
    setSearch("");
    setGame(ALL);
    setCar(ALL);
    setTrack(ALL);
    setCondition(ALL);
    setRig(ALL);
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
          <FilterSelect
            label="Rig"
            value={rig}
            onChange={setRig}
            options={rigProfiles}
            placeholder="All rigs"
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {hasMore
            ? `Showing ${visibleSetups.length} of ${filtered.length} setups`
            : `${filtered.length} ${filtered.length === 1 ? "setup" : "setups"} found`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setCompareMode((m) => !m);
              setCompareIds([]);
            }}
          >
            <GitCompare />
            Compare setups
          </Button>
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

      {compareMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-racing-coral/30 bg-racing-coral/10 px-4 py-2.5 text-sm">
          <span className="text-racing-coral">
            {compareIds.length === 0
              ? "Pick two setups to compare"
              : compareIds.length === 1
                ? "Pick one more setup to compare"
                : "Ready to compare"}
          </span>
          {compareIds.length === 2 && (
            <Button asChild size="sm">
              <Link href={`/setups/compare?a=${compareIds[0]}&b=${compareIds[1]}`}>Compare selected</Link>
            </Button>
          )}
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSetups.map((setup) => (
              <SetupCard
                key={setup.id}
                setup={setup}
                compareSelected={compareIds.includes(setup.id)}
                onToggleCompare={compareMode ? () => toggleCompareSelect(setup.id) : undefined}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                Load {Math.min(PAGE_SIZE, filtered.length - visibleSetups.length)} more
              </Button>
            </div>
          )}
        </>
      ) : setups.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No setups yet"
          description="Be the first to share one with the community."
          action={
            <Button asChild size="sm">
              <Link href="/upload">Upload Your Setup</Link>
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={SearchX}
          title="No setups match your filters"
          description="Try clearing a filter or check back soon — new setups are added every day."
          action={
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
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
