"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { loadMoreSetups } from "@/lib/actions/setup-browse";
import { conditions, games, getCarsForGame, getTracksForGame, rigProfiles } from "@/lib/data";
import { ALL, filterAndSortSetups, getSearchSuggestions, type SortOption } from "@/lib/filter-setups";
import type { BrowseFilters } from "@/lib/browse-filters";
import { isTypingTarget } from "@/lib/is-typing-target";
import { SETUP_CARD_PAGE_SIZE } from "@/lib/ui-constants";
import type { SetupCursor } from "@/lib/supabase/setups";
import { cn } from "@/lib/utils";
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

// Only the filters/sort, never page -- restoring an old page number without
// the matching result set to scroll through would be more confusing than
// useful.
const LAST_FILTERS_KEY = "setupsheet:last-filters";

export function SetupsBrowser({
  setups,
  totalCount,
  initialFilters,
}: {
  setups: Setup[];
  totalCount: number;
  initialFilters: BrowseFilters;
}) {
  const searchParams = useSearchParams();
  const [additionalSetups, setAdditionalSetups] = useState<Setup[]>([]);
  const [remoteCursor, setRemoteCursor] = useState<SetupCursor | null>(() => {
    const lastSetup = setups.at(-1);
    return lastSetup ? { createdAt: lastSetup.uploadedAt, id: lastSetup.id } : null;
  });

  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [isLoadingOlder, startLoadingOlder] = useTransition();

  const loadedSetups = useMemo(
    () => [...setups, ...additionalSetups],
    [setups, additionalSetups]
  );
  const hasMoreRemote = Boolean(remoteCursor && loadedSetups.length < totalCount);

  const [search, setSearch] = useState(initialFilters.search);
  const [game, setGame] = useState<string>(initialFilters.game);
  const [car, setCar] = useState<string>(initialFilters.car);
  const [track, setTrack] = useState<string>(initialFilters.track);
  const [condition, setCondition] = useState<string>(initialFilters.condition);
  const [rig, setRig] = useState<string>(initialFilters.rig);
  // Both the appended pages and the keyset cursor describe one specific query.
  // Filters are applied client-side over the server-rendered index, so the
  // moment any filter changes, rows appended under the previous filters are a
  // different result set and the cursor points into the wrong ordering -- using
  // either can duplicate or silently skip setups. Re-seeding from the current
  // server index on every filter/index change is what keeps "load older"
  // honest. (Adjusting state during render rather than in an effect, so the
  // first paint after the change already reflects it -- same pattern as
  // NotificationBell.)
  const filterSignature = JSON.stringify([search, game, car, track, condition, rig]);
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  const [prevSetups, setPrevSetups] = useState(setups);
  if (prevFilterSignature !== filterSignature || prevSetups !== setups) {
    setPrevFilterSignature(filterSignature);
    setPrevSetups(setups);
    setAdditionalSetups([]);
    setRemoteError(null);
    const lastSetup = setups.at(-1);
    setRemoteCursor(lastSetup ? { createdAt: lastSetup.uploadedAt, id: lastSetup.id } : null);
  }

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" focuses this search box -- the always-visible one on this page,
  // unlike the header's which only renders at the xl breakpoint.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      const url = new URL(window.location.href);
      url.search = query;
      // These filters are applied entirely in this client component. Using
      // Next router.replace here would trigger a full RSC request (and reload
      // up to 500 setups) on every debounce while the user types. Native
      // history integration updates the shareable URL without rerendering the
      // server page; a real navigation/refresh still reads the query normally.
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

      localStorage.setItem(
        LAST_FILTERS_KEY,
        JSON.stringify({ search, game, car, track, condition, rig, sort })
      );
    }, 300);

    return () => clearTimeout(id);
  }, [search, game, car, track, condition, rig, sort, page]);

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

  // Restores the last-used filters from a previous visit -- but only on a
  // bare /setups nav with no query string at all, so an explicit URL (a
  // shared link, or even just ?sort=fastest) always wins over local history.
  // Runs once client-side after mount rather than in the state initializers
  // above, since localStorage isn't available during SSR and reading it
  // there would produce a hydration mismatch.
  useEffect(() => {
    if (searchParams.toString() !== "") return;
    const saved = localStorage.getItem(LAST_FILTERS_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<Record<string, string>>;
      // Hydrating from localStorage (an external system) on mount, not
      // deriving from props/state -- the one legitimate case this lint
      // rule can't tell apart from a render-loop risk.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (parsed.search) setSearch(parsed.search);
      if (parsed.game) setGame(parsed.game);
      if (parsed.car) setCar(parsed.car);
      if (parsed.track) setTrack(parsed.track);
      if (parsed.condition) setCondition(parsed.condition);
      if (parsed.rig) setRig(parsed.rig);
      if (parsed.sort && (SORT_VALUES as string[]).includes(parsed.sort)) {
        setSort(parsed.sort as SortOption);
      }
    } catch {
      // Malformed localStorage value -- ignore and keep the defaults.
    }
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carOptions = useMemo(
    () => getCarsForGame(loadedSetups, game === ALL ? undefined : game),
    [loadedSetups, game]
  );
  const trackOptions = useMemo(
    () => getTracksForGame(loadedSetups, game === ALL ? undefined : game),
    [loadedSetups, game]
  );

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestions = useMemo(
    () => getSearchSuggestions(loadedSetups, search),
    [loadedSetups, search]
  );

  // Fuzzy matching includes bounded edit-distance work for every loaded
  // setup. Defer that derived list so the text field remains responsive on
  // lower-powered phones as the browse index grows.
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(
    () => filterAndSortSetups(loadedSetups, { search: deferredSearch, game, car, track, condition, rig }, sort),
    [loadedSetups, deferredSearch, game, car, track, condition, rig, sort]
  );

  const visibleSetups = filtered.slice(0, page * SETUP_CARD_PAGE_SIZE);
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

  function handleLoadOlder() {
    if (!remoteCursor || isLoadingOlder) return;
    const cursor = remoteCursor;
    setRemoteError(null);

    startLoadingOlder(async () => {
      try {
        const result = await loadMoreSetups(cursor, {
          search,
          game,
          car,
          track,
          condition,
          rig,
        });
        if (result.error) {
          setRemoteError(result.error);
          return;
        }

        setAdditionalSetups((previous) => {
          const knownIds = new Set([...setups, ...previous].map((setup) => setup.id));
          return [
            ...previous,
            ...result.setups.filter((setup) => !knownIds.has(setup.id)),
          ];
        });
        const nextCursor = result.nextCursor;
        setRemoteCursor(
          nextCursor &&
            (nextCursor.id !== cursor.id || nextCursor.createdAt !== cursor.createdAt)
            ? nextCursor
            : null
        );
      } catch {
        setRemoteError("Couldn't load older setups right now.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveSuggestionIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setShowSuggestions(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setActiveSuggestionIndex(-1);
                e.currentTarget.blur();
              } else if (e.key === "ArrowDown" && suggestions.length > 0) {
                e.preventDefault();
                setShowSuggestions(true);
                setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
              } else if (e.key === "ArrowUp" && suggestions.length > 0) {
                e.preventDefault();
                setShowSuggestions(true);
                setActiveSuggestionIndex((index) =>
                  index <= 0 ? suggestions.length - 1 : index - 1
                );
              } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
                e.preventDefault();
                setSearch(suggestions[activeSuggestionIndex]);
                setActiveSuggestionIndex(-1);
                setShowSuggestions(false);
              }
            }}
            placeholder="Search by car, track, game, or tag..."
            className="pl-9 pr-9"
            role="combobox"
            aria-label="Search setups"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls="setup-search-suggestions"
            aria-activedescendant={
              activeSuggestionIndex >= 0
                ? `setup-search-suggestion-${activeSuggestionIndex}`
                : undefined
            }
          />
          {!search && (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              /
            </kbd>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <ul
              id="setup-search-suggestions"
              role="listbox"
              className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-md border border-border/80 bg-popover shadow-lg"
            >
              {suggestions.map((suggestion, index) => (
                <li key={suggestion}>
                  <button
                    id={`setup-search-suggestion-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeSuggestionIndex === index}
                    // onMouseDown (not onClick) fires before the input's
                    // onBlur, and preventDefault stops that blur from
                    // happening at all -- otherwise the dropdown would
                    // close itself before the click could register.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    onClick={() => {
                      setSearch(suggestion);
                      setActiveSuggestionIndex(-1);
                      setShowSuggestions(false);
                    }}
                    className={cn(
                      "w-full truncate px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent",
                      activeSuggestionIndex === index && "bg-accent"
                    )}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
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

      <h2 id="setup-results-heading" className="sr-only">Setup results</h2>
      {filtered.length > 0 ? (
        <>
          <section aria-labelledby="setup-results-heading" aria-busy={deferredSearch !== search}>
            <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSetups.map((setup) => (
                <li key={setup.id} className="min-w-0">
                  <SetupCard
                    setup={setup}
                    compareSelected={compareIds.includes(setup.id)}
                    onToggleCompare={compareMode ? () => toggleCompareSelect(setup.id) : undefined}
                  />
                </li>
              ))}
            </ul>
          </section>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                Load {Math.min(SETUP_CARD_PAGE_SIZE, filtered.length - visibleSetups.length)} more
              </Button>
            </div>
          )}
        </>
      ) : loadedSetups.length === 0 ? (
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

      {hasMoreRemote && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="outline" onClick={handleLoadOlder} disabled={isLoadingOlder}>
            {isLoadingOlder ? "Loading older setups..." : "Load older setups"}
          </Button>
          {remoteError && (
            <p role="alert" className="text-sm text-racing-red">
              {remoteError}
            </p>
          )}
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
  const id = `filter-${label.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
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
