"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, Film, SlidersHorizontal } from "lucide-react";
import { Show } from "@/types";
import type { useShowFinder } from "@/hooks/useShowFinder";
import { getMovieMeta } from "@/lib/movies";
import { dateKey, dayLabel, formatPrice, formatTime, shortTitle, toDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Chip, EmptyState, ErrorState, Loading } from "@/components/ui/Feedback";
import { PosterImage } from "@/components/ui/Movie";

type Sort = "time" | "price" | "seats";

const DAY_PARTS = [
  { id: "morning", label: "Morning", from: 5, to: 12 },
  { id: "afternoon", label: "Afternoon", from: 12, to: 17 },
  { id: "evening", label: "Evening", from: 17, to: 21 },
  { id: "night", label: "Night", from: 21, to: 29 }, // runs past midnight to 5 am
];
const BUDGET = 1000;
const DAYS_AHEAD = 7;

const hourOf = (iso: string) => {
  const h = toDate(iso).getHours();
  return h < 5 ? h + 24 : h;
};

const sorters: Record<Sort, (a: Show, b: Show) => number> = {
  time: (a, b) => a.start_time.localeCompare(b.start_time),
  price: (a, b) => a.base_price - b.base_price,
  seats: (a, b) => b.available_seats - a.available_seats,
};

/** Green when plenty of seats are left, amber when it is filling up, red when almost gone. */
function availability(show: Show) {
  const left = show.available_seats / Math.max(1, show.total_seats);
  if (show.available_seats <= 0) return { dot: "bg-fg-muted", label: "Sold out" };
  if (left < 0.15) return { dot: "bg-danger", label: "Almost full" };
  if (left < 0.5) return { dot: "bg-warning", label: "Filling fast" };
  return { dot: "bg-success", label: "Available" };
}

const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function ShowFinder({
  finder,
  movie,
  onMovieChange,
}: {
  finder: ReturnType<typeof useShowFinder>;
  movie: string | null;
  onMovieChange: (title: string | null) => void;
}) {
  const { cinemas, cinemaId, setCinemaId, shows, state, reload } = finder;
  const [pickedDay, setDay] = useState<string | null>(null);
  const [part, setPart] = useState<string | null>(null);
  const [budget, setBudget] = useState(false);
  const [hasSeats, setHasSeats] = useState(false);
  const [sort, setSort] = useState<Sort>("time");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // At most one movie row is expanded at a time.
  const [expanded, setExpanded] = useState<string | null>(null);

  // The next 7 calendar days, starting today. Shows that already started are never offered.
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => localKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)));
  }, []);
  const upcoming = useMemo(() => {
    const now = Date.now();
    return shows.filter((s) => toDate(s.start_time).getTime() > now);
  }, [shows]);
  const showsPerDay = useMemo(() => {
    const counts = new Map<string, number>();
    upcoming.forEach((s) => counts.set(dateKey(s.start_time), (counts.get(dateKey(s.start_time)) ?? 0) + 1));
    return counts;
  }, [upcoming]);

  // The chosen day, else the first day that has any show.
  const day = pickedDay ?? days.find((d) => showsPerDay.has(d)) ?? days[0];

  const titles = useMemo(
    () => [...new Set(upcoming.filter((s) => dateKey(s.start_time) === day).map((s) => s.movie_title))],
    [upcoming, day]
  );

  const byMovie = useMemo(() => {
    const range = DAY_PARTS.find((p) => p.id === part);
    const list = upcoming
      .filter(
        (s) =>
          dateKey(s.start_time) === day &&
          (!movie || s.movie_title === movie) &&
          (!range || (hourOf(s.start_time) >= range.from && hourOf(s.start_time) < range.to)) &&
          (!budget || s.base_price <= BUDGET) &&
          (!hasSeats || s.available_seats > 0)
      )
      .sort(sorters[sort]);
    const groups = new Map<string, Show[]>();
    list.forEach((s) => groups.set(s.movie_title, [...(groups.get(s.movie_title) ?? []), s]));
    return [...groups.entries()];
  }, [upcoming, day, movie, part, budget, hasSeats, sort]);

  const activeFilters = [part, budget, hasSeats, sort !== "time"].filter(Boolean).length;
  const clearFilters = () => {
    onMovieChange(null);
    setPart(null);
    setBudget(false);
    setHasSeats(false);
    setSort("time");
  };

  return (
    <section id="shows" className="page scroll-mt-20 pt-12">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Showtimes</h2>

      <Card className="mt-4 space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select label="Cinema" value={cinemaId} onChange={(e) => setCinemaId(e.target.value)} className="sm:flex-1">
            {cinemas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Pick a date</span>
            <span className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
              <input
                type="date"
                value={day}
                min={days[0]}
                max={days[days.length - 1]}
                onChange={(e) => e.target.value && setDay(e.target.value)}
                className="h-10 w-full rounded-lg border bg-surface-2 pl-9 pr-3 text-sm text-fg [color-scheme:dark] focus:border-accent focus:outline-none"
              />
            </span>
          </label>
        </div>

        {/* Date strip: the quick way to switch days. Days with no shows are disabled. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar" role="group" aria-label="Choose a day">
          {days.map((key) => {
            const count = showsPerDay.get(key) ?? 0;
            const active = key === day;
            const d = new Date(`${key}T00:00:00`);
            return (
              <button
                key={key}
                type="button"
                disabled={count === 0}
                aria-pressed={active}
                onClick={() => setDay(key)}
                className={`flex w-16 shrink-0 flex-col items-center rounded-lg border py-2 transition-colors disabled:opacity-40 ${
                  active ? "border-accent bg-accent text-white" : "hover:border-fg-muted"
                }`}
              >
                <span className="text-[11px] uppercase">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                <span className={`text-[11px] ${active ? "text-white/80" : "text-fg-muted"}`}>
                  {d.toLocaleDateString(undefined, { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter by movie">
            <Chip active={movie === null} onClick={() => onMovieChange(null)}>
              All movies
            </Chip>
            {titles.map((t) => (
              <Chip key={t} active={movie === t} onClick={() => onMovieChange(movie === t ? null : t)}>
                {shortTitle(t)}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm ${
              activeFilters ? "border-accent text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeFilters ? ` (${activeFilters})` : ""}
          </button>
        </div>

        {filtersOpen && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Time of day">
              {DAY_PARTS.map((p) => (
                <Chip key={p.id} active={part === p.id} onClick={() => setPart(part === p.id ? null : p.id)}>
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Chip active={budget} onClick={() => setBudget(!budget)}>
                Under {formatPrice(BUDGET)}
              </Chip>
              <Chip active={hasSeats} onClick={() => setHasSeats(!hasSeats)}>
                Seats available
              </Chip>
              <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-44">
                <option value="time">Earliest first</option>
                <option value="price">Cheapest first</option>
                <option value="seats">Most seats left</option>
              </Select>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4">
        {state.status === "loading" ? (
          <Loading label="Loading showtimes" />
        ) : state.status === "error" ? (
          <ErrorState title="Could not load showtimes" error={state.error} onRetry={reload} />
        ) : byMovie.length === 0 ? (
          <EmptyState
            icon={Film}
            title={activeFilters || movie ? `No showtimes on ${dayLabel(day)} match these filters.` : `No showtimes on ${dayLabel(day)} at this cinema.`}
          >
            {(activeFilters > 0 || movie) && (
              <button type="button" onClick={clearFilters} className="text-sm font-medium text-accent hover:underline">
                Clear filters
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-sm text-fg-muted">
              {dayLabel(day)} · {byMovie.length} movie{byMovie.length === 1 ? "" : "s"}
            </p>
            <Card className="divide-y divide-border">
              {byMovie.map(([title, list]) => {
                const meta = getMovieMeta(title);
                const open = expanded === title;
                return (
                  <div key={title} className="p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      <PosterImage meta={meta} className="h-[84px] w-14 shrink-0 rounded-md object-cover" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : title)}
                          aria-expanded={open}
                          className="flex w-full items-start justify-between gap-2 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{shortTitle(title)}</span>
                            <span className="block text-xs text-fg-muted">
                              {meta.cert} · {meta.duration}
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-muted">
                            {open ? "Less" : "Details"}
                            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                          </span>
                        </button>

                        <div className="flex flex-wrap gap-2">
                          {list.map((show) => {
                            const a = availability(show);
                            const soldOut = show.available_seats <= 0;
                            return (
                              <Link
                                key={show.id}
                                href={soldOut ? "#shows" : `/shows/${show.id}/seats`}
                                aria-disabled={soldOut}
                                aria-label={`${formatTime(show.start_time)}, ${a.label}`}
                                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                                  soldOut ? "pointer-events-none opacity-40" : "hover:border-accent hover:text-accent"
                                }`}
                              >
                                <span className={`h-2 w-2 rounded-full ${a.dot}`} aria-hidden />
                                {formatTime(show.start_time)}
                              </Link>
                            );
                          })}
                        </div>

                        {open && (
                          <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
                            <p className="text-fg-muted">{meta.synopsis}</p>
                            <ul className="divide-y divide-border">
                              {list.map((show) => (
                                <li key={show.id} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                                  <span className="font-medium">
                                    {formatTime(show.start_time)} · Screen {show.screen_number}
                                  </span>
                                  <span className="text-fg-muted">
                                    from {formatPrice(show.base_price)} · {availability(show).label}, {show.available_seats} of{" "}
                                    {show.total_seats} left
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-hidden>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Available</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Filling fast</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" /> Almost full</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
