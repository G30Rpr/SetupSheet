"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { GitCompare, Search, SearchX, SlidersHorizontal, TriangleAlert, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { RetryButton } from "@/components/retry-button";
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
import { conditions, games, getCarsForGame, getTracksForGame, rigProfiles, setupTags } from "@/lib/data";
import {
  ALL,
  filterAndSortSetups,
  getSearchSuggestions,
  setupMatchesRigAxes,
  type SetupFilters,
  type SortOption,
} from "@/lib/filter-setups";
import type { BrowseFilters } from "@/lib/browse-filters";
import { isTypingTarget } from "@/lib/is-typing-target";
import { readLastRig, readMyRigAxes, writeLastRigAxes } from "@/lib/last-rig";
import {
  RIG_BRAKE_LABELS,
  RIG_BRAKE_TYPES,
  RIG_INPUT_DEVICES,
  RIG_INPUT_LABELS,
  type RigAxes,
} from "@/lib/rig-axes";
import { saveRigProfile } from "@/lib/actions/saved-rig";
import { SETUP_CARD_PAGE_SIZE } from "@/lib/ui-constants";
import type { SetupCursor } from "@/lib/supabase/setups";
import { cn } from "@/lib/utils";
import type { Setup } from "@/lib/types";

export const sortOptions: { value: SortOption; label: string }[] = [
  // Default. Exact two-axis hardware matches ("Matches your rig") lead, then
  // the legacy rig-category match, then rating count, then Predictability --
  // evidence before hype (see filterAndSortSetups' "bestMatch" case). The
  // value stays "bestMatch" so existing ?sort= links keep working.
  { value: "bestMatch", label: "Best for my rig" },
  { value: "newest", label: "Newest first" },
  // Value stays "trending" so existing bookmarked/shared ?sort= URLs keep
  // working, but it sorts by raw upvote count -- calling that "Trending"
  // implied a recency weighting the sort doesn't do.
  { value: "trending", label: "Most upvoted" },
  { value: "mostDownloaded", label: "Most downloaded" },
  { value: "safest", label: "Safest (predictability)" },
  { value: "fastest", label: "Fastest lap time" },
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
  loadFailed = false,
  fieldTestCounts = {},
  savedRigAxes = null,
  canSaveRig = false,
}: {
  setups: Setup[];
  totalCount: number | null;
  initialFilters: BrowseFilters;
  fieldTestCounts?: Record<string, number>;
  /** True when the server's browse read failed -- the grid is empty because the
   *  database was unreachable, not because nothing matched. */
  loadFailed?: boolean;
  /** The account-saved rig axes (saved_rig_profiles, 0040); null when signed out or none saved. */
  savedRigAxes?: RigAxes | null;
  /** Whether the viewer is signed in -- gates the account-level "Save" action. */
  canSaveRig?: boolean;
}) {
  const searchParams = useSearchParams();
  const [additionalSetups, setAdditionalSetups] = useState<Setup[]>([]);
  const [additionalFieldTestCounts, setAdditionalFieldTestCounts] = useState<Record<string, number>>({});
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
  const hasMoreRemote = Boolean(
    remoteCursor && (totalCount === null || loadedSetups.length < totalCount)
  );

  const [search, setSearch] = useState(initialFilters.search);
  const [game, setGame] = useState<string>(initialFilters.game);
  const [car, setCar] = useState<string>(initialFilters.car);
  const [track, setTrack] = useState<string>(initialFilters.track);
  const [condition, setCondition] = useState<string>(initialFilters.condition);
  const [rig, setRig] = useState<string>(initialFilters.rig);
  const [tag, setTag] = useState<string>(initialFilters.tag);
  // Both the appended pages and the keyset cursor describe one specific query.
  // Filters are applied client-side over the server-rendered index, so the
  // moment any filter changes, rows appended under the previous filters are a
  // different result set and the cursor points into the wrong ordering -- using
  // either can duplicate or silently skip setups. Re-seeding from the current
  // server index on every filter/index change is what keeps "load older"
  // honest. (Adjusting state during render rather than in an effect, so the
  // first paint after the change already reflects it -- same pattern as
  // NotificationBell.)
  const filterSignature = JSON.stringify([search, game, car, track, condition, rig, tag]);
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  const [prevSetups, setPrevSetups] = useState(setups);
  if (prevFilterSignature !== filterSignature || prevSetups !== setups) {
    setPrevFilterSignature(filterSignature);
    setPrevSetups(setups);
    setAdditionalSetups([]);
    setAdditionalFieldTestCounts({});
    setRemoteError(null);
    const lastSetup = setups.at(-1);
    setRemoteCursor(lastSetup ? { createdAt: lastSetup.uploadedAt, id: lastSetup.id } : null);
  }

  const [sort, setSort] = useState<SortOption>(() => {
    const fromUrl = searchParams.get("sort");
    return (SORT_VALUES as string[]).includes(fromUrl ?? "") ? (fromUrl as SortOption) : "bestMatch";
  });
  // The rig saved on this device (setupsheet:last-rig) seeds "Best match"
  // when no rig filter is selected. Read after mount: localStorage isn't
  // available during SSR.
  const [savedRig, setSavedRig] = useState<string | null>(null);
  useEffect(() => {
    // Hydrating from localStorage on mount, not deriving from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedRig(readLastRig());
  }, []);
  // "Your rig" as two axes (0039/0040): the account-saved profile when
  // signed in, else the device memory. Drives "Best for my rig" ordering and
  // the "Matches your rig" chip -- hardware context only, never a rating.
  const [myRig, setMyRig] = useState<RigAxes | null>(null);
  const [rigSaveState, setRigSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rigSaveError, setRigSaveError] = useState<string | null>(null);
  useEffect(() => {
    // Hydrating from the account row (server prop) or localStorage on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyRig(savedRigAxes ?? readMyRigAxes());
  }, [savedRigAxes]);

  const updateMyRig = (axes: RigAxes | null) => {
    setMyRig(axes);
    writeLastRigAxes(axes);
    setRigSaveState("idle");
    setRigSaveError(null);
  };

  const handleSaveRig = async () => {
    if (!myRig?.inputDevice) return;
    setRigSaveState("saving");
    setRigSaveError(null);
    const result = await saveRigProfile(myRig.inputDevice, myRig.brakeType);
    if (result.ok) {
      setRigSaveState("saved");
    } else {
      setRigSaveState("error");
      setRigSaveError(result.error);
    }
  };
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
      if (tag !== ALL) params.set("tag", tag);
      if (sort !== "bestMatch") params.set("sort", sort);
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
        JSON.stringify({ search, game, car, track, condition, rig, tag, sort })
      );
    }, 300);

    return () => clearTimeout(id);
  }, [search, game, car, track, condition, rig, tag, sort, page]);

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
  }, [search, game, car, track, condition, rig, tag, sort]);

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
      if (parsed.tag) setTag(parsed.tag);
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
    () =>
      filterAndSortSetups(
        loadedSetups,
        { search: deferredSearch, game, car, track, condition, rig, tag },
        sort,
        savedRig,
        myRig
      ),
    [loadedSetups, deferredSearch, game, car, track, condition, rig, tag, sort, savedRig, myRig]
  );

  // Rig categories with setups that match everything EXCEPT the rig filter --
  // named in the quiet "hiding" line so the missing rows are never a mystery.
  const hiddenRigNames = useMemo(() => {
    if (rig === ALL) return [];
    const withoutRigFilter = filterAndSortSetups(
      loadedSetups,
      { search: deferredSearch, game, car, track, condition, rig: ALL, tag },
      "newest"
    );
    const names = new Set<string>();
    for (const setup of withoutRigFilter) {
      if (setup.rigProfile !== rig) names.add(setup.rigProfile);
    }
    return Array.from(names);
  }, [loadedSetups, deferredSearch, game, car, track, condition, rig, tag]);

  const visibleSetups = filtered.slice(0, page * SETUP_CARD_PAGE_SIZE);
  const hasMore = filtered.length > visibleSetups.length;

  const hasActiveFilters =
    search !== "" ||
    game !== ALL ||
    car !== ALL ||
    track !== ALL ||
    condition !== ALL ||
    rig !== ALL ||
    tag !== ALL;

  function resetFilters() {
    setSearch("");
    setGame(ALL);
    setCar(ALL);
    setTrack(ALL);
    setCondition(ALL);
    setRig(ALL);
    setTag(ALL);
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
          tag,
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
        setAdditionalFieldTestCounts((previous) => ({
          ...previous,
          ...(result.fieldTestCounts ?? {}),
        }));
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
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              /
            </kbd>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <ul
              id="setup-search-suggestions"
              role="listbox"
              className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-md border border-border/80 bg-popover shadow-popover"
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
                      "min-h-11 w-full truncate px-3 py-2 text-left text-sm text-foreground hover:bg-accent",
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
          <FilterSelect
            label="Tag"
            value={tag}
            onChange={setTag}
            options={setupTags}
            placeholder="All tags"
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
        {/* buttons stay put when the count is hidden */}
        {/* No result count while the read is failing: "0 setups found" next to
            an error state reads as a filter problem. */}
        {!loadFailed && (
          <p className="text-sm text-muted-foreground">
            {hasMore
              ? `Showing ${visibleSetups.length} of ${filtered.length} setups`
              : `${filtered.length} ${filtered.length === 1 ? "setup" : "setups"} found`}
          </p>
        )}

        <div className={cn("flex flex-wrap items-center gap-2", loadFailed && "sm:ml-auto")}>
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

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-border/80 bg-secondary/40 px-4 py-3">
        <div>
          <span id="my-rig-label" className="text-xs font-medium text-muted-foreground">
            Your rig
          </span>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-2"
            role="group"
            aria-labelledby="my-rig-label"
          >
            <Select
              value={myRig?.inputDevice ?? ""}
              onValueChange={(value) =>
                updateMyRig({
                  // Gamepads have no pedal hardware of interest: brake axis
                  // goes null, matching rig_axes_for("Gamepad") in 0039.
                  inputDevice: value as NonNullable<RigAxes["inputDevice"]>,
                  brakeType: value === "gamepad" ? null : (myRig?.brakeType ?? null),
                })
              }
            >
              <SelectTrigger size="sm" className="w-[140px]" aria-label="How you steer">
                <SelectValue placeholder="Steering" />
              </SelectTrigger>
              <SelectContent>
                {RIG_INPUT_DEVICES.map((device) => (
                  <SelectItem key={device} value={device}>
                    {RIG_INPUT_LABELS[device]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={myRig?.brakeType ?? ""}
              disabled={!myRig?.inputDevice || myRig.inputDevice === "gamepad"}
              onValueChange={(value) =>
                updateMyRig({
                  inputDevice: myRig?.inputDevice ?? null,
                  brakeType: value as NonNullable<RigAxes["brakeType"]>,
                })
              }
            >
              <SelectTrigger
                size="sm"
                className="w-[150px]"
                aria-label="What stops the car"
              >
                <SelectValue
                  placeholder={
                    myRig?.inputDevice === "gamepad" ? "Not applicable" : "Brakes"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {RIG_BRAKE_TYPES.map((brake) => (
                  <SelectItem key={brake} value={brake}>
                    {RIG_BRAKE_LABELS[brake]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {myRig && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateMyRig(null)}
                aria-label="Clear your rig"
              >
                <X aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
        </div>
        {canSaveRig && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveRig}
            disabled={!myRig?.inputDevice || rigSaveState === "saving"}
          >
            {rigSaveState === "saved"
              ? "Saved"
              : rigSaveState === "saving"
                ? "Saving…"
                : "Save to account"}
          </Button>
        )}
        <p className="max-w-[42ch] text-xs text-muted-foreground">
          {myRig?.inputDevice
            ? myRig.brakeType || myRig.inputDevice === "gamepad"
              ? "Used for Best for my rig and match chips."
              : "Pick what stops the car to get matches."
            : "Set what you drive to sort Best for my rig and spot matches."}
        </p>
        {rigSaveError && (
          <p role="alert" className="text-xs text-destructive">
            {rigSaveError}
          </p>
        )}
      </div>

      {rig !== ALL && hiddenRigNames.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Hiding {joinRigNames(hiddenRigNames)} setups that don&apos;t match
          your rig.{" "}
          <button
            type="button"
            onClick={() => setRig(ALL)}
            className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            Show them
          </button>
        </p>
      )}

      {compareMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
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
                    fieldTestCount={fieldTestCounts[setup.id] ?? additionalFieldTestCounts[setup.id] ?? 0}
                    compareSelected={compareIds.includes(setup.id)}
                    onToggleCompare={compareMode ? () => toggleCompareSelect(setup.id) : undefined}
                    rigMatch={myRig ? setupMatchesRigAxes(setup, myRig) : false}
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
      ) : loadFailed && loadedSetups.length === 0 ? (
        // Empty grid + failed read is an outage, not a quiet community.
        <EmptyState
          tone="error"
          icon={TriangleAlert}
          title="Couldn't load setups"
          description="We couldn't reach the setup library just now — this isn't a filter problem. Nothing you've saved or uploaded is affected."
          action={<RetryButton />}
        />
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
        // Filters matched nothing in a non-empty library: hand the combo to
        // the requests board / Engineer instead of dead-ending on a blank
        // list (P3). The request link carries the combo as query params.
        <EmptyState
          icon={SearchX}
          title="No setup for this combo yet."
          description={describeEmptyCombo({ search, game, car, track, condition, rig, tag })}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild size="sm">
                <Link href={requestHrefForCombo({ game, car, track, condition, rig, tag })}>
                  Ask for this combo
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/engineer">Get a first change to test</Link>
              </Button>
            </div>
          }
        />
      )}

      {hasMoreRemote && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="outline" onClick={handleLoadOlder} disabled={isLoadingOlder}>
            {isLoadingOlder ? "Loading older setups..." : "Load older setups"}
          </Button>
          {remoteError && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p role="alert" className="text-sm text-destructive">
                {remoteError}
              </p>
              <RetryButton label="Retry loading older setups" onRetry={handleLoadOlder} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "A", "A and B", or "A, B, and C" — for naming hidden rig categories. */
function joinRigNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** The empty-combo sentence: "Nobody has shared a [rig] setup for [car] at [track] in the [condition]." */
function describeEmptyCombo(filters: SetupFilters): string {
  const { search, car, track, condition, rig, tag } = filters;
  if (search.trim()) {
    return `Nobody has shared a setup matching “${search.trim()}” yet.`;
  }
  const rigClause = rig !== ALL ? `${rig} ` : "";
  const tagClause = tag !== ALL ? ` tagged ${tag}` : "";
  const carClause = car !== ALL ? ` for ${car}` : "";
  const trackClause = track !== ALL ? ` at ${track}` : "";
  const conditionClause = condition !== ALL ? ` in the ${condition}` : "";
  return `Nobody has shared a ${rigClause}setup${tagClause}${carClause}${trackClause}${conditionClause}.`;
}

/** /requests with the empty combo prefilled via query params (tags stay out -- a request is a car/track ask). */
function requestHrefForCombo(filters: Omit<SetupFilters, "search">): string {
  const params = new URLSearchParams();
  if (filters.game !== ALL) params.set("game", filters.game);
  if (filters.car !== ALL) params.set("car", filters.car);
  if (filters.track !== ALL) params.set("track", filters.track);
  if (filters.condition !== ALL) params.set("condition", filters.condition);
  if (filters.rig !== ALL) params.set("rig", filters.rig);
  const query = params.toString();
  return query ? `/requests?${query}` : "/requests";
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
