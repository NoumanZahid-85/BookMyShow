"use client";

import { useMemo, useState } from "react";
import { Film, Search, Star } from "lucide-react";
import type { MovieMeta } from "@/lib/movies";
import { shortTitle } from "@/lib/format";
import { Chip, EmptyState } from "@/components/ui/Feedback";
import { Select, controlClass } from "@/components/ui/Field";
import { PosterImage } from "@/components/ui/Movie";

type Sort = "booked" | "rating" | "newest";

/** Movie cards with search, genre filter and sort. `movies` arrive sorted by tickets sold. */
export default function MovieGrid({ movies, onDetails }: { movies: MovieMeta[]; onDetails: (movie: MovieMeta) => void }) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("booked");

  const genres = useMemo(() => [...new Set(movies.flatMap((m) => m.genres))].sort(), [movies]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = movies.filter(
      (m) =>
        (!genre || m.genres.includes(genre)) &&
        (!q || [m.title, m.director, ...m.cast, ...m.genres].some((text) => text.toLowerCase().includes(q)))
    );
    if (sort === "rating") return [...list].sort((a, b) => b.rating - a.rating);
    if (sort === "newest") return [...list].sort((a, b) => b.year - a.year);
    return list;
  }, [movies, query, genre, sort]);

  return (
    <section id="movies" className="page scroll-mt-20 pt-12">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Now showing</h2>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="relative flex-1">
          <span className="sr-only">Search movies, cast or director</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, cast or director"
            className={`${controlClass} pl-9`}
          />
        </label>
        <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="lg:w-48">
          <option value="booked">Most booked</option>
          <option value="rating">Highest rated</option>
          <option value="newest">Newest</option>
        </Select>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter by genre">
        <Chip active={genre === null} onClick={() => setGenre(null)}>
          All
        </Chip>
        {genres.map((g) => (
          <Chip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)}>
            {g}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Film} title="No movies match these filters." />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {visible.map((m) => (
            <li key={m.title}>
              <button
                type="button"
                onClick={() => onDetails(m)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-surface text-left transition-colors hover:border-accent focus-visible:border-accent focus-visible:outline-none"
              >
                <PosterImage meta={m} className="aspect-[2/3] w-full object-cover" />
                <div className="space-y-1 p-3">
                  <h3 className="truncate font-semibold group-hover:text-accent">{shortTitle(m.title)}</h3>
                  <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    <span className="text-fg">{m.rating.toFixed(1)}</span>· {m.genres[0]}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
