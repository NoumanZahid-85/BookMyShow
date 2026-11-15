/**
 * Estimated view quality for a seat, from 0 (worst) to 1 (best).
 *
 * shortcut: a rule of thumb, not per-cinema sightline data. The sweet spot is about
 * 60% of the way back and close to the center line. Upgrade if cinemas publish their own seat ratings.
 */
const SWEET_SPOT = 0.6;

export type ViewBand = "best" | "good" | "side";

export interface ScorableSeat {
  seat_id: string;
  row: string;
  number: number;
}

/** `rowIndex` is 0 for the row nearest the screen; `seatsInRow` is how many seats that row has. */
export function viewScore(rowIndex: number, rowCount: number, number: number, seatsInRow: number): number {
  const depth = rowCount > 1 ? rowIndex / (rowCount - 1) : SWEET_SPOT;
  const rowScore = Math.max(0, 1 - Math.abs(depth - SWEET_SPOT) * 1.6);
  const center = (seatsInRow + 1) / 2;
  const centerScore = 1 - (Math.abs(number - center) / center) * 0.7;
  return Math.round(rowScore * centerScore * 100) / 100;
}

export function viewBand(score: number): ViewBand {
  if (score >= 0.7) return "best";
  if (score >= 0.45) return "good";
  return "side";
}

export const VIEW_LABEL: Record<ViewBand, string> = {
  best: "Best view",
  good: "Good view",
  side: "Side or close view",
};

/** Score every seat of a map at once. Rows are ordered A (front) to Z (back). */
export function scoreSeats(seats: ScorableSeat[]): Map<string, number> {
  const rows = [...new Set(seats.map((s) => s.row))].sort();
  const perRow = new Map(rows.map((r) => [r, seats.filter((s) => s.row === r).length]));
  return new Map(seats.map((s) => [s.seat_id, viewScore(rows.indexOf(s.row), rows.length, s.number, perRow.get(s.row)!)]));
}

/**
 * The `count` side-by-side seats with the best total view, among `open` seats only.
 * Returns [] when no row has that many free seats next to each other.
 */
export function bestBlock(open: ScorableSeat[], scores: Map<string, number>, count: number): string[] {
  let best: string[] = [];
  let bestScore = -1;
  const rows = [...new Set(open.map((s) => s.row))];
  for (const row of rows) {
    const inRow = open.filter((s) => s.row === row).sort((a, b) => a.number - b.number);
    for (let i = 0; i + count <= inRow.length; i++) {
      const block = inRow.slice(i, i + count);
      const together = block.every((s, k) => k === 0 || s.number === block[k - 1].number + 1);
      if (!together) continue;
      const total = block.reduce((sum, s) => sum + (scores.get(s.seat_id) ?? 0), 0);
      if (total > bestScore) {
        bestScore = total;
        best = block.map((s) => s.seat_id);
      }
    }
  }
  return best;
}
