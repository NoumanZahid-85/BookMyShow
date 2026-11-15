"use client";

import { useMemo, useState } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import Rankings from "@/components/home/Rankings";
import MovieGrid from "@/components/home/MovieGrid";
import MovieDetailModal from "@/components/home/MovieDetailModal";
import ShowFinder from "@/components/home/ShowFinder";
import { useCity } from "@/context/CityContext";
import { useShowFinder } from "@/hooks/useShowFinder";
import { useAsync } from "@/hooks/useAsync";
import { fetchRankings } from "@/lib/api";
import { getMovieMeta, MOVIES, type MovieMeta } from "@/lib/movies";

export default function HomePage() {
  const { city } = useCity();
  // Everything on this page is for the customer's own city.
  const finder = useShowFinder(city?.id ?? "");
  const rankings = useAsync(city ? `rankings:${city.id}` : null, () => fetchRankings(7, city!.id));
  const [movie, setMovie] = useState<string | null>(null);
  const [details, setDetails] = useState<MovieMeta | null>(null);

  // Last week's rank per movie title in this city, e.g. { "Dune: Part Two": 1 }.
  const ranks = useMemo(() => {
    const list = rankings.status === "ready" ? rankings.data.movies : [];
    return new Map(list.map((m, i) => [getMovieMeta(m.movie_title).title, i + 1]));
  }, [rankings]);

  const moviesByRank = useMemo(
    () => [...MOVIES].sort((a, b) => (ranks.get(a.title) ?? 99) - (ranks.get(b.title) ?? 99)),
    [ranks]
  );

  const showTimesFor = (title: string) => {
    // Showtime filters use the backend's title, which the finder already has.
    setMovie(finder.shows.find((s) => getMovieMeta(s.movie_title).title === getMovieMeta(title).title)?.movie_title ?? title);
    document.getElementById("shows")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <HeroCarousel movies={moviesByRank.slice(0, 5)} rankOf={(t) => ranks.get(t) ?? null} onBook={showTimesFor} onDetails={setDetails} />
      <Rankings rankings={rankings} cityName={city?.name} onRetry={rankings.reload} onPick={(t) => setDetails(getMovieMeta(t))} />
      <MovieGrid movies={moviesByRank} onDetails={setDetails} />
      <ShowFinder finder={finder} movie={movie} onMovieChange={setMovie} />
      <MovieDetailModal movie={details} onClose={() => setDetails(null)} onShowtimes={showTimesFor} />
    </>
  );
}
