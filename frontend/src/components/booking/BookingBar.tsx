import { Eye, Timer } from "lucide-react";
import { SeatItem } from "@/types";
import { formatPrice } from "@/lib/format";
import { MAX_SEATS } from "@/hooks/useSeatBooking";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Sticky summary: picked seats, total, and the one next action. */
export default function BookingBar({
  seats,
  total,
  holding,
  secondsLeft,
  busy,
  viewOnly,
  onHold,
  onRelease,
  onCheckout,
  onPreview,
}: {
  seats: SeatItem[];
  total: number;
  holding: boolean;
  secondsLeft: number;
  busy: boolean;
  /** Admins can look but not book. */
  viewOnly: boolean;
  onHold: () => void;
  onRelease: () => void;
  onCheckout: () => void;
  onPreview: (seat: SeatItem) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface">
      <div className="page flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-fg-muted">
            {seats.length ? `${seats.length} of ${MAX_SEATS} seats. Tap a seat to preview its view.` : "No seats picked yet"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {seats.map((s) => (
              <button
                key={s.seat_id}
                type="button"
                onClick={() => onPreview(s)}
                title={`Preview the view from ${s.seat_id}`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:border-accent"
              >
                {s.seat_id}
                <Eye className="h-3 w-3 text-fg-muted" />
              </button>
            ))}
            {seats.length > 0 && <span className="ml-2 text-sm font-semibold">{formatPrice(total)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {holding ? (
            <>
              <span
                className={`mr-2 inline-flex items-center gap-1.5 text-sm tabular-nums ${secondsLeft <= 60 ? "text-danger" : "text-warning"}`}
                aria-live="polite"
              >
                <Timer className="h-4 w-4" />
                {mmss(secondsLeft)} left
              </span>
              <Button variant="secondary" onClick={onRelease} disabled={busy}>
                Release
              </Button>
              <Button onClick={onCheckout} disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />}
                Pay {formatPrice(total)}
              </Button>
            </>
          ) : (
            <Button onClick={onHold} disabled={viewOnly || busy || seats.length === 0} className="w-full sm:w-auto">
              {busy && <Spinner className="h-4 w-4" />}
              {viewOnly ? "View only for admins" : "Hold seats for 10 min"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
