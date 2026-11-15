"use client";

import { useEffect, useRef, useState } from "react";

export interface SeatStreamEvent {
  event: "STREAM_CONNECTED" | "SEAT_HELD" | "SEAT_RELEASED" | "SEAT_BOOKED";
  show_id: string;
  seats?: string[];
  hold_id?: string;
  booking_id?: string;
}

// The Next.js rewrite proxy does not carry WebSocket upgrades, so connect to Nginx directly.
// Defaults to Nginx on the same host as the page, so it also works when opened from a phone on the LAN.
const wsBase = () => process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8080`;
const streamUrl = (showId: string) => `${wsBase()}/api/v1/shows/${showId}/seats/stream`;

/** Live seat events for one show. Reconnects after 3s; pings every 15s. */
export function useSeatStream(showId: string, onEvent: (event: SeatStreamEvent) => void) {
  const [isConnected, setIsConnected] = useState(false);
  // Keep the latest callback in a ref so a new callback does not restart the socket.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!showId) return;
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(streamUrl(showId));
      ws.onopen = () => setIsConnected(true);
      ws.onmessage = (msg) => {
        try {
          onEventRef.current(JSON.parse(msg.data));
        } catch {
          /* non-JSON pong */
        }
      };
      ws.onclose = () => {
        setIsConnected(false);
        retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };
    connect();

    const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 15000);

    return () => {
      clearInterval(ping);
      clearTimeout(retry);
      ws.onclose = null;
      ws.close();
    };
  }, [showId]);

  return { isConnected };
}
