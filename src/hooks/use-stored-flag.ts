"use client";

// An on/off preference remembered in this browser's localStorage, such as the chat's "Review before
// sending". Read through useSyncExternalStore: the server render and hydration use defaultValue, and
// the saved value shows right after. When storage is blocked, the choice lasts until the page reloads.
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const unsaved = new Map<string, boolean>(); // choices made while storage was blocked

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener); // the same setting changed in another tab
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string, defaultValue: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved === "true";
  } catch {
    // storage blocked, e.g. by privacy settings
  }
  return unsaved.get(key) ?? defaultValue;
}

export function useStoredFlag(key: string, defaultValue = false) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, defaultValue),
    () => defaultValue,
  );

  const setValue = useCallback(
    (next: boolean) => {
      unsaved.set(key, next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Not saved; the in-memory copy keeps it for this visit.
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, setValue] as const;
}
