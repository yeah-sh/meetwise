"use client";

// Preferences remembered in this browser's localStorage: on/off flags such as the chat's "Review before
// sending" (useStoredFlag) and short strings such as the chosen voice (useStoredString). Read through
// useSyncExternalStore: the server render and hydration use defaultValue, and the saved value shows
// right after. When storage is blocked, the choice lasts until the page reloads.
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const unsaved = new Map<string, string>(); // choices made while storage was blocked

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener); // the same setting changed in another tab
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): string | null {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved;
  } catch {
    // storage blocked, e.g. by privacy settings
  }
  return unsaved.get(key) ?? null;
}

export function useStoredString(key: string, defaultValue = "") {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? defaultValue,
    () => defaultValue,
  );

  const setValue = useCallback(
    (next: string) => {
      unsaved.set(key, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Not saved; the in-memory copy keeps it for this visit.
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, setValue] as const;
}

export function useStoredFlag(key: string, defaultValue = false) {
  const [saved, setSaved] = useStoredString(key, String(defaultValue));
  const setValue = useCallback((next: boolean) => setSaved(String(next)), [setSaved]);
  return [saved === "true", setValue] as const;
}
