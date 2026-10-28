"use client";

// Re-renders the current server page every few seconds while `active` is true, so the meetings
// list picks up status changes of meetings that are still being processed. Renders nothing.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 5000;

export function RefreshWhileProcessing({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}
