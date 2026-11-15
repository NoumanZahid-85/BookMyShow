"use client";

import { useEffect, useRef, useState } from "react";
import { SeatMapData } from "@/types";
import { fetchSeatMap } from "@/lib/api";
import { useSeatStream } from "@/hooks/useSeatStream";

export const WINDOW = 60; // seconds of samples kept

type Series = { rps: number[]; p50: number[]; p95: number[]; p99: number[] };
const EMPTY: Series = { rps: [], p50: [], p95: [], p99: [] };

const push = (arr: number[], v: number) => [...arr, v].slice(-WINDOW);

/** Nearest-rank percentile of an ascending list. */
export const percentile = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

/**
 * Samples one show every second: seat events seen on the WebSocket, and the real
 * latency of a seat map request. Latency percentiles cover the last WINDOW samples.
 */
export function useLiveMetrics(showId: string) {
  const [series, setSeries] = useState<Series>(EMPTY);
  const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const events = useRef(0);
  const latencies = useRef<number[]>([]);

  const { isConnected } = useSeatStream(showId, (ev) => {
    if (ev.event === "STREAM_CONNECTED") return;
    events.current += 1;
    setLastEvent(ev.event);
  });

  useEffect(() => {
    if (!showId) return;
    let cancelled = false;
    events.current = 0;
    latencies.current = [];
    setSeries(EMPTY);
    setSeatMap(null);
    setLastEvent(null);

    const tick = async () => {
      const count = events.current;
      events.current = 0;
      const start = performance.now();
      const map = await fetchSeatMap(showId).catch(() => null);
      if (cancelled) return;
      if (map) {
        latencies.current = push(latencies.current, performance.now() - start);
        setSeatMap(map);
      }
      const sorted = [...latencies.current].sort((a, b) => a - b);
      setSeries((s) => ({
        rps: push(s.rps, count),
        p50: push(s.p50, percentile(sorted, 0.5)),
        p95: push(s.p95, percentile(sorted, 0.95)),
        p99: push(s.p99, percentile(sorted, 0.99)),
      }));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [showId]);

  return { series, seatMap, lastEvent, isConnected };
}
