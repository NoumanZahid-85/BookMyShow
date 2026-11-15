"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { City } from "@/types";
import { fetchCities } from "@/lib/api";
import { nearestCitySlug } from "@/lib/cities";
import { useAsync } from "@/hooks/useAsync";

/**
 * Where the customer is watching. Exactly one of:
 * reading the saved choice, asking (picker open), locating (waiting for GPS), or set.
 */
type CityState =
  | { status: "reading" }
  | { status: "asking"; error?: string }
  | { status: "locating" }
  | { status: "set"; cityId: string };

interface CityContextType {
  cities: City[];
  citiesError: string | null;
  reloadCities: () => void;
  state: CityState;
  city: City | null;
  useMyLocation: () => void;
  chooseCity: (cityId: string) => void;
  /** Opens the picker again. */
  changeCity: () => void;
}

const KEY = "bms_city";
const CityContext = createContext<CityContextType | undefined>(undefined);

export function CityProvider({ children }: { children: React.ReactNode }) {
  const req = useAsync("cities", fetchCities);
  const cities = req.status === "ready" ? req.data : [];
  const [state, setState] = useState<CityState>({ status: "reading" });

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* storage blocked: just ask */
    }
    setState(saved ? { status: "set", cityId: saved } : { status: "asking" });
  }, []);

  const chooseCity = (cityId: string) => {
    try {
      localStorage.setItem(KEY, cityId);
    } catch {
      /* the choice still works for this visit */
    }
    setState({ status: "set", cityId });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setState({ status: "asking", error: "This browser cannot share your location. Pick your city below." });
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const slug = nearestCitySlug(coords.latitude, coords.longitude, cities.map((c) => c.slug));
        const city = cities.find((c) => c.slug === slug);
        if (city) chooseCity(city.id);
        else setState({ status: "asking", error: "We could not match your location to a city. Pick one below." });
      },
      () => setState({ status: "asking", error: "Location was blocked or timed out. Pick your city below." }),
      { timeout: 10_000, maximumAge: 600_000 }
    );
  };

  // A saved city that no longer exists (for example after a reseed) sends the user back to the picker.
  const city = state.status === "set" ? cities.find((c) => c.id === state.cityId) ?? null : null;
  useEffect(() => {
    if (state.status === "set" && req.status === "ready" && !city) setState({ status: "asking" });
  }, [state, req.status, city]);

  return (
    <CityContext.Provider
      value={{
        cities,
        citiesError: req.status === "error" ? req.error : null,
        reloadCities: req.reload,
        state,
        city,
        useMyLocation,
        chooseCity,
        changeCity: () => setState({ status: "asking" }),
      }}
    >
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within a CityProvider");
  return ctx;
}
