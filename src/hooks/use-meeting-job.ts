"use client";

// Follows one meeting through processing. While it is UPLOADED, TRANSCRIBING or ANALYSING, polls
// GET /api/meetings/[id]/status every 3 seconds; stops once it is READY or FAILED. retry() asks
// POST /api/meetings/[id]/retry to run a FAILED meeting again, which restarts the polling.
// Used by the upload form and by the meeting page.
import { useEffect, useState } from "react";
import { errorText, readJson } from "@/lib/api-client";
import { isProcessing } from "@/lib/meeting-status";
import type { MeetingStatus, MeetingStatusResponse, ProcessingStarted } from "@/types";

const POLL_INTERVAL_MS = 3000;

export type MeetingJob = { meetingId: string; status: MeetingStatus; errorMessage: string | null };

export function useMeetingJob(initialJob: MeetingJob | null) {
  const [job, setJob] = useState<MeetingJob | null>(initialJob);
  const [pollError, setPollError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const meetingId = job?.meetingId;
  const processing = job !== null && isProcessing(job.status);

  useEffect(() => {
    if (!meetingId || !processing) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/status`, { cache: "no-store" });
        const body = await readJson<MeetingStatusResponse>(response);
        if (stopped) return;
        setJob({ meetingId, ...body });
        setPollError(null);
      } catch (pollFailure) {
        if (stopped) return;
        setPollError(`Could not check progress: ${errorText(pollFailure)} Still trying…`);
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [meetingId, processing]);

  // Starts processing a FAILED meeting again. Returns an error message, or null when it started.
  async function retry(): Promise<string | null> {
    if (!job) return null;
    setRetrying(true);
    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(job.meetingId)}/retry`, { method: "POST" });
      const started = await readJson<ProcessingStarted>(response);
      setJob({ meetingId: started.id, status: started.status, errorMessage: null });
      return null;
    } catch (retryFailure) {
      return errorText(retryFailure);
    } finally {
      setRetrying(false);
    }
  }

  // Follows a different meeting, or none (null).
  function track(next: MeetingJob | null) {
    setJob(next);
    setPollError(null);
  }

  return { job, track, pollError, retry, retrying };
}
