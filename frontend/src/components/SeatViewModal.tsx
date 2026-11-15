"use client";

import { SeatItem } from "@/types";
import { formatPrice } from "@/lib/format";
import { VIEW_LABEL, viewBand } from "@/lib/seatScore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/** Rough camera angle by row. View quality comes from `viewScore`, same as the heatmap. */
function sightline(seat: SeatItem) {
  const row = seat.row.toUpperCase();
  const depth =
    row <= "B"
      ? { distance: 8, scale: 1.2, tilt: 8 }
      : row <= "E"
        ? { distance: 14, scale: 1, tilt: 2 }
        : { distance: 22, scale: 0.85, tilt: -6 };
  const offset = seat.number - 8; // 15 seats per row, 8 is the center
  const side = Math.abs(offset) <= 2 ? "Center" : offset < 0 ? "Left side" : "Right side";
  return { ...depth, pan: offset * 1.8, side };
}

export default function SeatViewModal({
  seat,
  score,
  movieTitle,
  poster,
  isSelected,
  onToggle,
  onClose,
}: {
  seat: SeatItem | null;
  score: number;
  movieTitle: string;
  poster?: string | null;
  isSelected: boolean;
  onToggle?: (seat: SeatItem) => void;
  onClose: () => void;
}) {
  if (!seat) return null;
  const view = sightline(seat);

  return (
    <Modal open onClose={onClose} title={`View from seat ${seat.seat_id}`} className="max-w-3xl">
      <div className="flex h-72 items-center justify-center overflow-hidden bg-black [perspective:1000px] sm:h-96">
        <div
          className="aspect-video w-[75%] overflow-hidden rounded-lg border border-white/20 bg-surface-2"
          style={{ transform: `scale(${view.scale}) rotateX(${view.tilt}deg) rotateY(${view.pan}deg)` }}
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={movieTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-lg font-semibold">{movieTitle}</div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-medium">{VIEW_LABEL[viewBand(score)]}</p>
          <p className="mt-1 text-fg-muted">
            {view.side} · about {view.distance} m from the screen · {formatPrice(seat.price)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Back to map
          </Button>
          {onToggle && (
            <Button
              variant={isSelected ? "danger" : "primary"}
              onClick={() => {
                onToggle(seat);
                onClose();
              }}
            >
              {isSelected ? "Remove seat" : "Select seat"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
