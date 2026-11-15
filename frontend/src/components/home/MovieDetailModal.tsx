import { Star } from "lucide-react";
import type { MovieMeta } from "@/lib/movies";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Feedback";
import { PosterImage } from "@/components/ui/Movie";

/** Story, cast and tags for one movie, with a shortcut to its showtimes. */
export default function MovieDetailModal({
  movie,
  onClose,
  onShowtimes,
}: {
  movie: MovieMeta | null;
  onClose: () => void;
  onShowtimes: (title: string) => void;
}) {
  if (!movie) return null;

  return (
    <Modal open onClose={onClose} title={movie.title} className="max-w-2xl">
      <div className="grid gap-6 p-5 sm:grid-cols-[180px_1fr]">
        <PosterImage meta={movie} className="hidden aspect-[2/3] w-full rounded-lg border object-cover sm:block" />
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">{movie.tagline}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" />
              {movie.rating.toFixed(1)}
            </span>
            <span className="text-fg-muted">
              {movie.year} · {movie.duration} · {movie.cert}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {movie.genres.map((g) => (
              <Tag key={g}>{g}</Tag>
            ))}
          </div>

          <div>
            <h3 className="eyebrow">Story</h3>
            <p className="mt-1 text-sm leading-relaxed">{movie.synopsis}</p>
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow">Director</dt>
              <dd className="mt-1">{movie.director}</dd>
            </div>
            {movie.cast.length > 0 && (
              <div>
                <dt className="eyebrow">Cast</dt>
                <dd className="mt-1">{movie.cast.join(", ")}</dd>
              </div>
            )}
          </dl>

          <Button
            onClick={() => {
              onShowtimes(movie.title);
              onClose();
            }}
          >
            See showtimes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
