"use client";

import { use, useMemo, useState } from "react";
import { SeatItem, SeatTier } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSeatBooking } from "@/hooks/useSeatBooking";
import { useShowDetails } from "@/hooks/useShowDetails";
import { getMovieMeta } from "@/lib/movies";
import { formatDate, formatTime, plural } from "@/lib/format";
import { scoreSeats } from "@/lib/seatScore";
import { PageHeader } from "@/components/ui/PageHeader";
import { StepTracker } from "@/components/ui/StepTracker";
import { Card } from "@/components/ui/Card";
import { Alert, ErrorState, Loading, StatusPill } from "@/components/ui/Feedback";
import { PosterImage } from "@/components/ui/Movie";
import SeatMap from "@/components/booking/SeatMap";
import SeatHelper from "@/components/booking/SeatHelper";
import BookingBar from "@/components/booking/BookingBar";
import PaymentModal from "@/components/booking/PaymentModal";
import SeatViewModal from "@/components/SeatViewModal";

export default function SeatSelectionPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = use(params);
  const { token, isAdmin } = useAuth();
  const booking = useSeatBooking(showId, token);
  const { show, cinema } = useShowDetails(showId);
  const [preview, setPreview] = useState<SeatItem | null>(null);
  const [heatmap, setHeatmap] = useState(true);
  const [tier, setTier] = useState<SeatTier | null>(null);

  const meta = show ? getMovieMeta(show.movie_title) : null;
  const { step } = booking.phase;
  const paying = step === "checkout" || step === "paying";
  const holding = step !== "selecting" && step !== "holding";
  const scores = useMemo(() => scoreSeats(booking.seats), [booking.seats]);
  const freeSeats = booking.seats.filter((s) => booking.stateOf(s) === "available");
  const almostFull = booking.seats.length > 0 && freeSeats.length < booking.seats.length * 0.15;

  return (
    <div className="page space-y-5 pb-44 pt-6">
      <StepTracker current={paying ? 3 : 2} />

      <PageHeader
        back={{ href: "/#shows", label: "Back to showtimes" }}
        title={
          <span className="flex items-center gap-3">
            {meta && <PosterImage meta={meta} className="hidden h-14 w-10 shrink-0 rounded object-cover sm:block" />}
            {show?.movie_title ?? "Choose your seats"}
          </span>
        }
        subtitle={
          show && (
            <>
              {cinema?.name && `${cinema.name} · `}Screen {show.screen_number} · {formatDate(show.start_time)},{" "}
              {formatTime(show.start_time)}
            </>
          )
        }
        actions={
          <StatusPill tone={booking.isConnected ? "success" : "warning"} pulse={booking.isConnected}>
            {booking.isConnected ? "Live seats" : "Connecting"}
          </StatusPill>
        }
      />

      {isAdmin && <Alert tone="warning">You are signed in as an admin. You can view this seat map, but only customers can book.</Alert>}
      {almostFull && step === "selecting" && (
        <Alert tone="warning">Only {plural(freeSeats.length, "seat")} left for this show. Seats are held for 10 minutes once you pick them.</Alert>
      )}
      {booking.notice && <Alert>{booking.notice}</Alert>}

      {booking.map.status === "ready" && (
        <SeatHelper
          seats={booking.seats}
          freeSeats={freeSeats}
          scores={scores}
          heatmap={heatmap}
          onHeatmap={setHeatmap}
          tier={tier}
          onTier={setTier}
          onPick={booking.selectSeats}
          disabled={step !== "selecting" || isAdmin}
        />
      )}

      <Card className="p-4 sm:p-8">
        {booking.map.status === "loading" ? (
          <Loading label="Loading seats" />
        ) : booking.map.status === "error" ? (
          <ErrorState title="Could not load the seat map" error={booking.map.error} onRetry={booking.reload} />
        ) : (
          <SeatMap
            seats={booking.seats}
            stateOf={booking.stateOf}
            scores={scores}
            heatmap={heatmap}
            tier={tier}
            onSeat={booking.toggleSeat}
            locked={step !== "selecting"}
          />
        )}
      </Card>

      <BookingBar
        seats={booking.selectedSeats}
        total={booking.total}
        holding={holding}
        secondsLeft={booking.secondsLeft}
        busy={booking.busy}
        viewOnly={isAdmin}
        onHold={booking.holdSeats}
        onRelease={booking.releaseSeats}
        onCheckout={booking.startCheckout}
        onPreview={setPreview}
      />

      <PaymentModal
        open={paying}
        seats={booking.selectedSeats}
        total={booking.total}
        busy={booking.busy}
        onPay={booking.pay}
        onClose={booking.cancelCheckout}
      />

      <SeatViewModal
        seat={preview}
        score={preview ? (scores.get(preview.seat_id) ?? 0) : 0}
        movieTitle={show?.movie_title ?? "Feature presentation"}
        poster={meta?.poster}
        isSelected={Boolean(preview && booking.selectedSeats.some((s) => s.seat_id === preview.seat_id))}
        onToggle={step === "selecting" ? booking.toggleSeat : undefined}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
