"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { SeatItem, SeatTier } from "@/types";
import { formatPrice } from "@/lib/format";
import { bestBlock } from "@/lib/seatScore";
import { MAX_SEATS } from "@/hooks/useSeatBooking";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Feedback";
import { TIER_NAME } from "@/components/booking/SeatMap";

const TIERS: SeatTier[] = ["SILVER", "GOLD", "PLATINUM"];

/**
 * Helps people decide: price per tier with seats left, a view heatmap,
 * and "pick the best seats for me" for a group size.
 */
export default function SeatHelper({
  seats,
  freeSeats,
  scores,
  heatmap,
  onHeatmap,
  tier,
  onTier,
  onPick,
  disabled,
}: {
  seats: SeatItem[];
  freeSeats: SeatItem[];
  scores: Map<string, number>;
  heatmap: boolean;
  onHeatmap: (on: boolean) => void;
  tier: SeatTier | null;
  onTier: (tier: SeatTier | null) => void;
  onPick: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [size, setSize] = useState(2);
  const [message, setMessage] = useState<string | null>(null);

  const pick = () => {
    const pool = tier ? freeSeats.filter((s) => s.tier === tier) : freeSeats;
    const ids = bestBlock(pool, scores, size);
    if (ids.length) {
      onPick(ids);
      onHeatmap(true);
      setMessage(`Picked ${ids.join(", ")}: the best ${size} seats together${tier ? ` in ${TIER_NAME[tier]}` : ""}.`);
    } else {
      setMessage(`No ${size} seats together are free${tier ? ` in ${TIER_NAME[tier]}` : ""}. Try a smaller group or another tier.`);
    }
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Seat types">
        {TIERS.map((t) => {
          const all = seats.filter((s) => s.tier === t);
          const free = freeSeats.filter((s) => s.tier === t).length;
          const active = tier === t;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={active}
              onClick={() => onTier(active ? null : t)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                active ? "border-accent bg-accent/10" : "hover:border-fg-muted"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{TIER_NAME[t]}</span>
                <span className="block text-xs text-fg-muted">Rows {[...new Set(all.map((s) => s.row))].join(", ")}</span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold">{all[0] ? formatPrice(all[0].price) : "-"}</span>
                <span className={`block text-xs ${free < 5 ? "text-danger" : "text-fg-muted"}`}>{free} left</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-fg-muted">How many?</span>
          {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => (
            <Chip key={n} active={size === n} onClick={() => setSize(n)}>
              {n}
            </Chip>
          ))}
          <Button size="sm" onClick={pick} disabled={disabled}>
            <Sparkles className="h-4 w-4" />
            Pick best seats for me
          </Button>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={heatmap}
            onChange={(e) => onHeatmap(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--success))]"
          />
          Show best views
        </label>
      </div>

      {message && (
        <p className="text-sm text-fg-muted" aria-live="polite">
          {message}
        </p>
      )}
    </Card>
  );
}
