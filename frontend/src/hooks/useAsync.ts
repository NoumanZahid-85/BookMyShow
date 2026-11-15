"use client";

import { useCallback, useEffect, useState } from "react";
import { Async } from "@/types";

/**
 * Runs a loader and exposes exactly one status: loading, ready or error.
 * Pass `null` as the key to wait (stays loading). `reload` retries.
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>): Async<T> & { reload: () => void } {
  const [state, setState] = useState<Async<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let stale = false;
    setState({ status: "loading" });
    load()
      .then((data) => !stale && setState({ status: "ready", data }))
      .catch((e: Error) => !stale && setState({ status: "error", error: e.message }));
    return () => {
      stale = true;
    };
    // `load` is intentionally not a dependency: the key says when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
