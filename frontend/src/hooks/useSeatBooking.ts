"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Async, SeatItem, SeatMapData, SeatState } from "@/types";
import {
  createPaymentSessionApi,
  fetchSeatMap,
  generateTicketApi,
  holdSeatsApi,
  releaseSeatsApi,
  simulatePaymentApi,
} from "@/lib/api";
import { useSeatStream } from "@/hooks/useSeatStream";
import { toDate } from "@/lib/format";

export const MAX_SEATS = 6;

type Hold = { id: string; expiresAt: number };

/**
 * The booking flow is one state machine. Exactly one step is active:
 *
 *   selecting → holding → held → opening → checkout → paying → (ticket page)
 *                  ↓        ↓ releasing                  ↓ declined
 *              selecting  selecting                   selecting
 */
export type BookingPhase =
  | { step: "selecting" }
  | { step: "holding" }
  | { step: "held"; hold: Hold }
  | { step: "releasing"; hold: Hold }
  | { step: "opening"; hold: Hold }
  | { step: "checkout"; hold: Hold; paymentId: string }
  | { step: "paying"; hold: Hold; paymentId: string };

const BUSY_STEPS = ["holding", "releasing", "opening", "paying"];
const statusOf = (seat: SeatItem) => (seat.availability || seat.status || "AVAILABLE").toUpperCase();
const LIVE_STATUS: Record<string, SeatItem["status"]> = {
  SEAT_HELD: "HELD",
  SEAT_RELEASED: "AVAILABLE",
  SEAT_BOOKED: "BOOKED",
};

export function useSeatBooking(showId: string, token: string | null) {
  const router = useRouter();
  const [map, setMap] = useState<Async<SeatMapData>>({ status: "loading" });
  const [phase, setPhase] = useState<BookingPhase>({ step: "selecting" });
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const hold = "hold" in phase ? phase.hold : null;
  const holdId = hold?.id;
  const holdExpiry = hold?.expiresAt;

  const reload = useCallback(
    () =>
      fetchSeatMap(showId)
        .then((data) => setMap({ status: "ready", data }))
        // A failed refresh keeps the seats already on screen.
        .catch((e: Error) => setMap((prev) => (prev.status === "ready" ? prev : { status: "error", error: e.message }))),
    [showId]
  );

  useEffect(() => {
    setMap({ status: "loading" });
    reload();
  }, [reload]);

  const backToSelecting = useCallback(
    (message: string | null) => {
      setPhase({ step: "selecting" });
      setSelected([]);
      setNotice(message);
      reload();
    },
    [reload]
  );

  const { isConnected } = useSeatStream(showId, (ev) => {
    const status = LIVE_STATUS[ev.event];
    if (!status || !ev.seats?.length) return;
    setMap((prev) =>
      prev.status !== "ready"
        ? prev
        : {
            status: "ready",
            data: {
              ...prev.data,
              seats: prev.data.seats.map((s) =>
                ev.seats!.includes(s.seat_id)
                  ? { ...s, status, availability: undefined, is_mine: Boolean(holdId) && ev.hold_id === holdId }
                  : s
              ),
            },
          }
    );
  });

  // Hold countdown. At zero the server has already freed the seats.
  useEffect(() => {
    if (!holdExpiry) return;
    const tick = () => {
      const left = Math.max(0, Math.round((holdExpiry - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) backToSelecting("Your hold expired. The seats are free again.");
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [holdExpiry, backToSelecting]);

  const seats = map.status === "ready" ? map.data.seats : [];
  const selectedSeats = seats.filter((s) => selected.includes(s.seat_id));

  const stateOf = (seat: SeatItem): SeatState => {
    const status = statusOf(seat);
    const mine = selected.includes(seat.seat_id);
    if (status !== "AVAILABLE" && status !== "HELD") return "taken"; // BOOKED, BROKEN, ...
    if (status === "HELD" && !(mine && hold) && !seat.is_mine) return "held";
    return mine ? "selected" : "available";
  };

  const toggleSeat = (seat: SeatItem) => {
    if (phase.step !== "selecting" || statusOf(seat) !== "AVAILABLE") return;
    if (selected.includes(seat.seat_id)) {
      setSelected((prev) => prev.filter((id) => id !== seat.seat_id));
    } else if (selected.length >= MAX_SEATS) {
      setNotice(`You can pick up to ${MAX_SEATS} seats.`);
    } else {
      setNotice(null);
      setSelected((prev) => [...prev, seat.seat_id]);
    }
  };

  /** Replaces the whole selection, e.g. with "best seats for me". Only while still choosing. */
  const selectSeats = (ids: string[]) => {
    if (phase.step !== "selecting") return;
    setNotice(null);
    setSelected(ids.slice(0, MAX_SEATS));
  };

  /** Moves to `pending`, runs the request, then lands on its result or falls back to `onFail`. */
  const transition = async (pending: BookingPhase, action: () => Promise<BookingPhase | void>, onFail: BookingPhase) => {
    setPhase(pending);
    setNotice(null);
    try {
      const next = await action();
      if (next) setPhase(next);
    } catch (e) {
      setNotice((e as Error).message);
      setPhase(onFail);
      reload();
    }
  };

  const holdSeats = () => {
    if (phase.step !== "selecting" || !token || !selected.length) return;
    transition(
      { step: "holding" },
      async () => {
        const key = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const res = await holdSeatsApi(token, showId, selected, key);
        reload();
        return { step: "held", hold: { id: res.hold_id, expiresAt: toDate(res.expires_at).getTime() } };
      },
      { step: "selecting" }
    );
  };

  const releaseSeats = () => {
    if (phase.step !== "held" || !token) return;
    transition(
      { step: "releasing", hold: phase.hold },
      async () => {
        await releaseSeatsApi(token, showId, phase.hold.id, selected);
        backToSelecting(null);
      },
      phase
    );
  };

  const startCheckout = () => {
    if (phase.step !== "held" || !token) return;
    transition(
      { step: "opening", hold: phase.hold },
      async () => {
        const session = await createPaymentSessionApi(token, showId, phase.hold.id);
        return { step: "checkout", hold: phase.hold, paymentId: session.payment_id };
      },
      phase
    );
  };

  const cancelCheckout = () => phase.step === "checkout" && setPhase({ step: "held", hold: phase.hold });

  const pay = (success: boolean) => {
    if (phase.step !== "checkout" || !token) return;
    transition(
      { ...phase, step: "paying" },
      async () => {
        const result = await simulatePaymentApi(phase.paymentId, success);
        if (success && result.booking_id) {
          const ticket = await generateTicketApi(token, result.booking_id);
          router.push(`/tickets/${ticket.ticket_id}`);
          return; // stay on "paying" until the ticket page takes over
        }
        backToSelecting("Payment declined. Your seats were released.");
      },
      phase
    );
  };

  return {
    map,
    reload,
    phase,
    busy: BUSY_STEPS.includes(phase.step),
    notice,
    isConnected,
    seats,
    selectedSeats,
    total: selectedSeats.reduce((sum, s) => sum + s.price, 0),
    secondsLeft,
    stateOf,
    toggleSeat,
    selectSeats,
    holdSeats,
    releaseSeats,
    startCheckout,
    cancelCheckout,
    pay,
  };
}
