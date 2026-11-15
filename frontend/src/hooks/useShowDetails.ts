"use client";

import { fetchCinema, fetchShow } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";

/** Show + its cinema, loaded from the API so deep links and page refresh work. */
export function useShowDetails(showId: string | undefined) {
  const req = useAsync(showId ?? null, async () => {
    const show = await fetchShow(showId!);
    // The cinema name is a nice-to-have; a failure there should not hide the show.
    const cinema = await fetchCinema(show.cinema_id).catch(() => null);
    return { show, cinema };
  });
  return req.status === "ready" ? req.data : { show: null, cinema: null };
}
