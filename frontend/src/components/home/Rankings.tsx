import { Trophy } from "lucide-react";
import { Async, Rankings as RankingsData } from "@/types";
import { getMovieMeta } from "@/lib/movies";
import { plural, shortTitle } from "@/lib/format";
import { EmptyState, ErrorState, Loading } from "@/components/ui/Feedback";
import { PosterImage } from "@/components/ui/Movie";

/** Last week's top movies in the customer's city, ranked by tickets sold. */
export default function Rankings({
  rankings,
  cityName,
  onRetry,
  onPick,
}: {
  rankings: Async<RankingsData>;
  cityName?: string;
  onRetry: () => void;
  onPick: (title: string) => void;
}) {
  return (
    <section className="page pt-8 sm:pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Top 5 last week{cityName ? ` in ${cityName}` : ""}</h2>
        <p className="text-sm text-fg-muted">Ranked by tickets sold</p>
      </div>

      <div className="mt-4">
        {rankings.status === "loading" ? (
          <Loading label="Loading rankings" />
        ) : rankings.status === "error" ? (
          <ErrorState title="Could not load rankings" error={rankings.error} onRetry={onRetry} />
        ) : rankings.data.movies.length === 0 ? (
          <EmptyState icon={Trophy} title="No tickets were sold here in the last 7 days." />
        ) : (
          <ol className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
            {rankings.data.movies.map((m, i) => (
              <li key={m.movie_title} className="w-36 shrink-0 snap-start sm:w-auto">
                <button type="button" onClick={() => onPick(m.movie_title)} className="group block w-full text-left">
                  <div className="relative">
                    <PosterImage
                      meta={getMovieMeta(m.movie_title)}
                      className="aspect-[2/3] w-full rounded-lg border object-cover transition-colors group-hover:border-accent"
                    />
                    {/* Solid badge on the poster corner: always readable, never hidden behind the image. */}
                    <span
                      className={`absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-lg font-extrabold shadow-lg ${
                        i === 0 ? "bg-accent text-white" : "bg-bg/90 text-fg ring-1 ring-border"
                      }`}
                    >
                      <span className="sr-only">Rank </span>
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold group-hover:text-accent">{shortTitle(m.movie_title)}</p>
                  <p className="text-sm text-fg-muted">{plural(m.tickets, "ticket")} sold</p>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
