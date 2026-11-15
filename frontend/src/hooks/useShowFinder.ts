"use client";

import { useState } from "react";
import { Async, Show } from "@/types";
import { fetchCinemasByCity, fetchCities, fetchShowsByCinema } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";

const listOf = <T,>(a: Async<T[]>) => (a.status === "ready" ? a.data : []);

/**
 * City → cinema → shows cascade.
 * The selected city and cinema are derived (picked value, else the first in the list),
 * so there is no "selected id that no longer exists" state to keep in sync.
 */
export function useShowFinder(fixedCityId?: string) {
  const [pickedCity, setCityId] = useState("");
  const [pickedCinema, setCinemaId] = useState("");

  const citiesReq = useAsync("cities", fetchCities);
  const cities = listOf(citiesReq);
  // Customers are pinned to the city they chose; admins can switch freely.
  const wanted = fixedCityId ?? pickedCity;
  const cityId = cities.some((c) => c.id === wanted) ? wanted : fixedCityId ? "" : cities[0]?.id ?? "";

  const cinemasReq = useAsync(cityId || null, () => fetchCinemasByCity(cityId));
  const cinemas = listOf(cinemasReq);
  const cinemaId = cinemas.some((c) => c.id === pickedCinema) ? pickedCinema : cinemas[0]?.id ?? "";

  const showsReq = useAsync(cinemaId || null, () => fetchShowsByCinema(cinemaId));

  // The first failed or unfinished step decides the single status of the whole cascade.
  const steps = [citiesReq, cinemasReq, showsReq];
  const failed = steps.find((s) => s.status === "error");
  const nothingToLoad = (citiesReq.status === "ready" && !cityId) || (cinemasReq.status === "ready" && !cinemaId);
  const state: Async<Show[]> = failed
    ? { status: "error", error: (failed as { error: string }).error }
    : nothingToLoad
      ? { status: "ready", data: [] }
      : showsReq.status === "ready" && cinemasReq.status === "ready"
        ? showsReq
        : { status: "loading" };

  return {
    cities,
    cityId,
    setCityId,
    cinemas,
    cinemaId,
    setCinemaId,
    cinema: cinemas.find((c) => c.id === cinemaId),
    state,
    shows: state.status === "ready" ? state.data : [],
    reload: () => steps.find((s) => s.status === "error")?.reload() ?? showsReq.reload(),
  };
}
