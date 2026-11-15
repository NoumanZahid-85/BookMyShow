"use client";

import { useState } from "react";
import { Clapperboard, Clock3, Star } from "lucide-react";
import type { MovieMeta } from "@/lib/movies";

/** Poster with a plain fallback when the remote image fails. */
export function PosterImage({ meta, className = "" }: { meta: MovieMeta; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !meta.poster) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-surface-2 p-3 text-center ${className}`}>
        <Clapperboard className="h-6 w-6 text-fg-muted" />
        <span className="text-xs font-medium text-fg-muted">{meta.title}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={meta.poster}
      alt={`${meta.title} poster`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      style={{ objectPosition: meta.posterPosition || "center" }}
    />
  );
}

/** Rating · runtime · certificate · genres, in one muted line. */
export function MovieFacts({ meta, className = "" }: { meta: MovieMeta; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted ${className}`}>
      <span className="inline-flex items-center gap-1 text-fg">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
        {meta.rating.toFixed(1)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3.5 w-3.5" />
        {meta.duration}
      </span>
      <span>{meta.cert}</span>
      <span>{meta.genres.slice(0, 2).join(", ")}</span>
    </div>
  );
}
