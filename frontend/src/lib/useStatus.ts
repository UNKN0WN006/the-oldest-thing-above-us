"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "./api/client";
import type { Status } from "./api/types";

export interface StatusState {
  status: Status | null;
  error: ApiError | null;
}

/** Polls the data-service status. While a refresh is running it polls faster. */
export function useStatus(): StatusState {
  const [state, setState] = useState<StatusState>({ status: null, error: null });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const tick = async () => {
      let delay = 60_000;
      try {
        const status = await api.status(controller.signal);
        setState({ status, error: null });
        if (status.refresh?.running) delay = 5_000;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState((prev) => ({ status: prev.status, error: e as ApiError }));
        delay = 15_000;
      }
      timer = setTimeout(tick, delay);
    };
    void tick();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return state;
}
