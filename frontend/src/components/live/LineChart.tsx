import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export type ChartSeries = { name: string; color: string; data: number[] };

const W = 300;
const H = 110;
const PAD = 6;

/** Minimal SVG line chart. Colors are CSS values, e.g. "rgb(var(--accent))". */
export function LineChart({ series, unit = "" }: { series: ChartSeries[]; unit?: string }) {
  const max = Math.max(1, ...series.flatMap((s) => s.data)) * 1.15;
  const x = (i: number, n: number) => PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Line chart">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} style={{ stroke: "rgb(var(--border))" }} strokeWidth="1" />
      ))}
      {series.map(
        (s) =>
          s.data.length > 1 && (
            <polyline
              key={s.name}
              points={s.data.map((v, i) => `${x(i, s.data.length)},${y(v)}`).join(" ")}
              fill="none"
              style={{ stroke: s.color }}
              strokeWidth="1.8"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )
      )}
      <text x={4} y={12} fontSize="8" style={{ fill: "rgb(var(--fg-muted))" }}>
        {max.toFixed(0)}
        {unit}
      </text>
    </svg>
  );
}

export function ChartPanel({
  title,
  series,
  unit,
  footer,
}: {
  title: string;
  series: ChartSeries[];
  unit?: string;
  footer?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <ul className="flex gap-3 text-xs text-fg-muted">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <LineChart series={series} unit={unit} />
      </div>
      {footer && <div className="mt-3 flex justify-between border-t pt-3 text-xs text-fg-muted">{footer}</div>}
    </Card>
  );
}
