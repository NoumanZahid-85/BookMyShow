"use client";

import Link from "next/link";
import { Show } from "@/types";
import { useLiveMetrics, WINDOW } from "@/hooks/useLiveMetrics";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/Feedback";
import { ChartPanel } from "@/components/live/LineChart";

const COLOR = { accent: "rgb(var(--accent))", warning: "rgb(var(--warning))", muted: "rgb(var(--fg-muted))" };
const last = (arr: number[]) => arr[arr.length - 1] ?? 0;

/** Live numbers for one show, sampled every second from the real API and seat stream. */
export default function LivePanel({ show }: { show: Show }) {
  const { series, seatMap, lastEvent, isConnected } = useLiveMetrics(show.id);
  const taken = seatMap ? seatMap.held_count + seatMap.booked_count : 0;
  const stats: [string, string][] = [
    ["Seat events / sec", String(last(series.rps))],
    ["P99 latency", `${last(series.p99).toFixed(0)} ms`],
    ["Occupancy", seatMap ? `${Math.round((taken / Math.max(1, seatMap.total_seats)) * 100)}%` : "-"],
    ["Last event", lastEvent?.replace("SEAT_", "").toLowerCase() ?? "-"],
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Live: {show.movie_title}</h2>
        <div className="flex items-center gap-2">
          <StatusPill tone={isConnected ? "success" : "warning"} pulse={isConnected}>
            {isConnected ? "Stream live" : "Stream offline"}
          </StatusPill>
          <Link href={`/shows/${show.id}/seats`} className={buttonClass("secondary", "sm")}>
            Open seat map
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-4">
            <dt className="eyebrow">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
          </Card>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel
          title="Seat events per second"
          series={[{ name: "events", color: COLOR.accent, data: series.rps }]}
          footer={<span>Last {WINDOW} seconds</span>}
        />
        <ChartPanel
          title="Seat map latency"
          unit="ms"
          series={[
            { name: "P50", color: COLOR.muted, data: series.p50 },
            { name: "P95", color: COLOR.warning, data: series.p95 },
            { name: "P99", color: COLOR.accent, data: series.p99 },
          ]}
          footer={
            <>
              <span className="font-mono">GET /shows/:id/seats</span>
              <span className="tabular-nums">
                {last(series.p50).toFixed(0)} / {last(series.p95).toFixed(0)} / {last(series.p99).toFixed(0)} ms
              </span>
            </>
          }
        />
      </div>

      {seatMap && (
        <Card className="space-y-3 p-5">
          <h3 className="text-sm font-medium">Occupancy</h3>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="bg-warning" style={{ width: `${(seatMap.held_count / seatMap.total_seats) * 100}%` }} />
            <div className="bg-accent" style={{ width: `${(seatMap.booked_count / seatMap.total_seats) * 100}%` }} />
          </div>
          <p className="text-sm text-fg-muted">
            {seatMap.available_count} open · {seatMap.held_count} held · {seatMap.booked_count} sold of {seatMap.total_seats}
          </p>
        </Card>
      )}
    </section>
  );
}
