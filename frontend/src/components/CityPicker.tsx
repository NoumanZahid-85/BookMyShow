"use client";

import { LocateFixed, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCity } from "@/context/CityContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert, ErrorState, Spinner } from "@/components/ui/Feedback";

/** Asks where the customer is, once. Location first, a plain city list as the fallback. */
export default function CityPicker() {
  const { isAdmin } = useAuth();
  const { cities, citiesError, reloadCities, state, city, useMyLocation, chooseCity } = useCity();
  // Admins work across every city from the dashboard, so they are never asked.
  const open = !isAdmin && (state.status === "asking" || state.status === "locating");
  const locating = state.status === "locating";

  return (
    <Modal
      open={open}
      // Closing without a choice is only allowed when a city is already set.
      onClose={() => city && chooseCity(city.id)}
      title="Where are you watching?"
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-fg-muted">We show cinemas and showtimes for one city at a time.</p>

        {state.status === "asking" && state.error && <Alert tone="warning">{state.error}</Alert>}

        <Button className="w-full" size="lg" onClick={useMyLocation} disabled={locating || cities.length === 0}>
          {locating ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
          {locating ? "Finding your city" : "Use my location"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-fg-muted">
          <span className="h-px flex-1 bg-border" />
          or pick a city
          <span className="h-px flex-1 bg-border" />
        </div>

        {citiesError ? (
          <ErrorState title="Could not load cities" error={citiesError} onRetry={reloadCities} />
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {cities.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => chooseCity(c.id)}
                  disabled={locating}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-colors hover:border-accent disabled:opacity-50 ${
                    city?.id === c.id ? "border-accent" : ""
                  }`}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-fg-muted" />
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-xs text-fg-muted">{c.province}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
