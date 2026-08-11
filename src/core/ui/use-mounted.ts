"use client";

import { useSyncExternalStore } from "react";

// "Has this component hydrated yet?" — false during server rendering and the
// first client render, true afterwards. Use it for the handful of things the
// server genuinely cannot know (the visitor's system colour scheme, for
// example) so the first paint matches the server HTML.
//
// useSyncExternalStore rather than useState + useEffect: same result without
// a cascading render (and without tripping react-hooks/set-state-in-effect).
const neverChanges = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true, // client
    () => false, // server snapshot
  );
}
