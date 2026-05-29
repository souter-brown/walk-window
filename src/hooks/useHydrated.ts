"use client";

import { useSyncExternalStore } from "react";

function emptySubscribe() {
  return () => {};
}

/** True after client hydration — avoids SSR mismatches for browser-only UI. */
export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
