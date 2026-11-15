"use client";

import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { MovieMeta } from "@/lib/movies";
import { shortTitle } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Feedback";
import { PosterImage } from "@/components/ui/Movie";

/**
 * Full first screen: fills the viewport under the 57px header (h-14 + border), so rankings start below the fold.
 * The background is a flat dark tint from the movie's darkest accent color, so there is no bright spot.
 */
export default function HeroCarousel({
  movies,
  rankOf,
  onBook,
  onDetails,
}: {
  movies: MovieMeta[];
  rankOf: (title: string) => number | null;
  onBook: (title: string) => void;
  onDetails: (movie: MovieMeta) => void;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 7000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setActive(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  return (
    <section className="relative border-b" aria-roledescription="carousel" aria-label="Featured movies">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {movies.map((m) => {
            const rank = rankOf(m.title);
            return (
              <div
                key={m.title}
                className="flex min-h-[calc(100svh-57px)] min-w-0 flex-[0_0_100%]"
                style={{ background: `linear-gradient(90deg, rgb(var(--bg)) 0%, rgb(var(--bg)) 35%, ${m.accent[2]} 100%)` }}
              >
                <div className="page flex w-full flex-col justify-center gap-6 pb-16 pt-8 md:flex-row md:items-center md:justify-between md:gap-12">
                  <div className="order-2 min-w-0 flex-1 space-y-4 md:order-1 sm:space-y-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent sm:text-sm">
                      {rank ? `#${rank} in your city last week` : "Now showing"}
                    </p>
                    <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">{shortTitle(m.title)}</h1>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted sm:text-base">
                      <span className="inline-flex items-center gap-1 text-fg">
                        <Star className="h-4 w-4 fill-warning text-warning" />
                        {m.rating.toFixed(1)}
                      </span>
                      <span>{m.duration}</span>
                      <span>{m.cert}</span>
                      <span className="hidden gap-1.5 sm:inline-flex">
                        {m.genres.slice(0, 3).map((g) => (
                          <Tag key={g}>{g}</Tag>
                        ))}
                      </span>
                    </div>
                    <p className="line-clamp-3 max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-lg">{m.synopsis}</p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button size="lg" onClick={() => onBook(m.title)}>Book tickets</Button>
                      <Button variant="secondary" size="lg" onClick={() => onDetails(m)}>
                        Story and cast
                      </Button>
                    </div>
                  </div>
                  <PosterImage
                    meta={m}
                    className="order-1 aspect-[2/3] w-36 shrink-0 rounded-xl border object-cover shadow-2xl sm:w-44 md:order-2 md:w-64 lg:w-80"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="page absolute inset-x-0 bottom-5 flex items-center justify-between">
        <div className="flex gap-1.5">
          {movies.map((m, i) => (
            <button
              key={m.title}
              type="button"
              onClick={() => embla?.scrollTo(i)}
              aria-label={`Show ${m.title}`}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-accent" : "w-2.5 bg-fg/25 hover:bg-fg/50"}`}
            />
          ))}
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button variant="secondary" size="sm" onClick={() => embla?.scrollPrev()} aria-label="Previous movie">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => embla?.scrollNext()} aria-label="Next movie">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
