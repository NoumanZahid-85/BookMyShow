"use client";

import { ErrorState } from "@/components/ui/Feedback";

/** Catches render errors in any page so the app never shows a blank screen. */
export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page max-w-xl pt-24">
      <ErrorState title="Something went wrong on this page" error={error.message} onRetry={reset} />
    </div>
  );
}
