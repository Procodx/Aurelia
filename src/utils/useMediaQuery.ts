import { useSyncExternalStore } from "react";

// Live media-query hook, so layout decisions follow rotation, split-screen
// and window resizes instead of being frozen at mount time.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
