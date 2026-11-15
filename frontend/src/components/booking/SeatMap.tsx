import { useEffect, useRef } from "react";
import { SeatItem, SeatState, SeatTier } from "@/types";
import { formatPrice } from "@/lib/format";
import { VIEW_LABEL, viewBand, type ViewBand } from "@/lib/seatScore";

const seatClass: Record<SeatState, string> = {
  available: "border-fg-muted/40 text-fg-muted hover:border-accent hover:text-fg",
  selected: "border-accent bg-accent text-white",
  held: "cursor-not-allowed border-warning/40 bg-warning/15 text-warning/70",
  taken: "cursor-not-allowed border-transparent bg-surface-2 text-fg-muted/40",
};

/** Heatmap colors for free seats only. Green means a better view. */
const heatClass: Record<ViewBand, string> = {
  best: "border-success bg-success/35 text-fg hover:border-accent",
  good: "border-success/40 bg-success/10 text-fg hover:border-accent",
  side: "border-fg-muted/25 text-fg-muted/70 hover:border-accent",
};

export const TIER_NAME: Record<SeatTier, string> = { SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };

export function SeatBox({ className }: { className: string }) {
  return <span className={`inline-block h-4 w-4 rounded border ${className}`} />;
}

export default function SeatMap({
  seats,
  stateOf,
  scores,
  heatmap,
  tier,
  onSeat,
  locked,
}: {
  seats: SeatItem[];
  stateOf: (seat: SeatItem) => SeatState;
  scores: Map<string, number>;
  /** Color free seats by how good the view is. */
  heatmap: boolean;
  /** When set, seats of other tiers are dimmed. */
  tier: SeatTier | null;
  onSeat: (seat: SeatItem) => void;
  /** While a hold is active, the selection cannot change. */
  locked: boolean;
}) {
  const rows = [...new Set(seats.map((s) => s.row))].sort();
  const scroller = useRef<HTMLDivElement>(null);

  // On narrow screens the map is wider than the card: start at the center, where the best seats are.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [seats.length]);

  return (
    <div>
      <div className="mx-auto mb-6 max-w-md text-center">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-transparent via-fg/60 to-transparent" />
        <p className="eyebrow mt-2">Screen this way</p>
      </div>

      <p className="mb-2 text-center text-xs text-fg-muted sm:hidden">Swipe sideways to see every seat</p>
      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="mx-auto w-max space-y-1.5">
          {rows.map((row) => {
            const rowSeats = seats.filter((s) => s.row === row).sort((a, b) => a.number - b.number);
            const first = rowSeats[0];
            const half = Math.ceil(rowSeats.length / 2);
            return (
              <div key={row} className="flex items-center gap-2 sm:gap-3">
                <span className="w-4 text-center text-xs font-medium text-fg-muted">{row}</span>
                <div className="flex gap-1 sm:gap-1.5">
                  {rowSeats.map((seat, i) => {
                    const state = stateOf(seat);
                    const band = viewBand(scores.get(seat.seat_id) ?? 0);
                    const disabled = state === "taken" || state === "held" || (locked && state !== "selected");
                    const dimmed = tier !== null && seat.tier !== tier && state !== "selected";
                    const look = state === "available" && heatmap ? heatClass[band] : seatClass[state];
                    return (
                      <button
                        key={seat.seat_id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSeat(seat)}
                        aria-pressed={state === "selected"}
                        aria-label={`Seat ${seat.seat_id}, ${TIER_NAME[seat.tier]}, ${formatPrice(seat.price)}, ${VIEW_LABEL[band]}, ${state}`}
                        title={`${seat.seat_id} · ${formatPrice(seat.price)} · ${VIEW_LABEL[band]}`}
                        className={`h-7 w-7 rounded-md border text-[10px] font-medium transition sm:h-8 sm:w-8 sm:text-[11px] ${look} ${
                          dimmed ? "opacity-25" : ""
                        } ${i === half ? "ml-3 sm:ml-5" : ""}`}
                      >
                        {seat.number}
                      </button>
                    );
                  })}
                </div>
                <span className="hidden w-36 whitespace-nowrap text-xs text-fg-muted sm:block">
                  {first && `${TIER_NAME[first.tier]} · ${formatPrice(first.price)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t pt-5 text-xs text-fg-muted">
        {heatmap ? (
          <>
            <li className="flex items-center gap-2"><SeatBox className={heatClass.best} /> Best view</li>
            <li className="flex items-center gap-2"><SeatBox className={heatClass.good} /> Good view</li>
            <li className="flex items-center gap-2"><SeatBox className={heatClass.side} /> Side or close</li>
          </>
        ) : (
          <li className="flex items-center gap-2"><SeatBox className={seatClass.available} /> Available</li>
        )}
        <li className="flex items-center gap-2"><SeatBox className={seatClass.selected} /> Selected</li>
        <li className="flex items-center gap-2"><SeatBox className={seatClass.held} /> Held by someone</li>
        <li className="flex items-center gap-2"><SeatBox className={seatClass.taken} /> Sold</li>
      </ul>
    </div>
  );
}
