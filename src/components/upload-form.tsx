"use client";

// Upload form with live progress. Sends the recording to POST /api/meetings, then polls
// GET /api/meetings/[id]/status every 3 seconds until the meeting is READY or FAILED.
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Circle, CircleAlert, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ApiError, MeetingStatus, MeetingStatusResponse, ProcessingStarted } from "@/types";

const POLL_INTERVAL_MS = 3000;
const BYTES_PER_MB = 1024 * 1024;

const STEPS = ["Uploading", "Transcribing", "Analysing", "Ready"] as const;
// UPLOADED means the file is saved and the AI is about to start, so it shows as the transcribing step.
const STEP_INDEX: Record<Exclude<MeetingStatus, "FAILED">, number> = {
  UPLOADED: 1,
  TRANSCRIBING: 1,
  ANALYSING: 2,
  READY: 3,
};
const STEP_HINTS = [
  "Sending the recording to the server…",
  "Turning the speech into text. This can take a minute or two.",
  "Writing the summary, tasks, decisions and the rest of the report…",
  "Your report is ready.",
];

type Job = { meetingId: string; status: MeetingStatus; errorMessage: string | null };

type UploadFormProps = {
  accept: string; // allowed extensions, e.g. ".mp3,.m4a"
  maxUploadMb: number;
};

export function UploadForm({ accept, maxUploadMb }: UploadFormProps) {
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null); // a failed upload or retry request
  const [pollError, setPollError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [formKey, setFormKey] = useState(0); // a new key renders an empty form

  const meetingId = job?.meetingId;
  const processing = job !== null && job.status !== "READY" && job.status !== "FAILED";

  // Poll while the meeting is being processed; stops once it is READY or FAILED.
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read before the inputs are disabled: FormData skips disabled fields.
    const form = new FormData(event.currentTarget);
    const problem = checkFile(form.get("audio"), accept, maxUploadMb);
    setError(problem);
    if (problem) return;

    setUploading(true);
    try {
      const response = await fetch("/api/meetings", { method: "POST", body: form });
      const started = await readJson<ProcessingStarted>(response);
      setJob({ meetingId: started.id, status: started.status, errorMessage: null });
    } catch (uploadFailure) {
      setError(errorText(uploadFailure));
    } finally {
      setUploading(false);
    }
  }

  async function handleRetry() {
    if (!job) return;
    setRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(job.meetingId)}/retry`, { method: "POST" });
      const started = await readJson<ProcessingStarted>(response);
      setJob({ meetingId: started.id, status: started.status, errorMessage: null });
    } catch (retryFailure) {
      setError(errorText(retryFailure));
    } finally {
      setRetrying(false);
    }
  }

  function handleReset() {
    setJob(null);
    setError(null);
    setPollError(null);
    setFormKey((key) => key + 1);
  }

  const locked = uploading || job !== null;
  const step = uploading ? 0 : job && job.status !== "FAILED" ? STEP_INDEX[job.status] : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Upload a meeting</CardTitle>
        <CardDescription>
          Upload a recording ({accept.replaceAll(",", ", ")}, up to {maxUploadMb} MB) to get a transcript and a report.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="audio">Recording</Label>
            <Input id="audio" name="audio" type="file" accept={accept} required disabled={locked} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" name="title" maxLength={200} placeholder="Leave empty to use the AI's title" disabled={locked} />
          </div>
          <Button type="submit" disabled={locked}>
            {uploading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
            Upload
          </Button>
        </form>

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step !== null && (
          <div className="flex flex-col gap-3">
            <ProgressSteps current={step} />
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {STEP_HINTS[step]}
            </p>
            {pollError && <p className="text-sm text-destructive">{pollError}</p>}
          </div>
        )}

        {job?.status === "READY" && (
          <div className="flex gap-2">
            <Link href={`/meetings/${job.meetingId}`} className={buttonVariants()}>
              Open the report
            </Link>
            <Button variant="outline" onClick={handleReset}>
              Upload another
            </Button>
          </div>
        )}

        {job?.status === "FAILED" && (
          <div className="flex flex-col gap-3">
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Processing failed</AlertTitle>
              <AlertDescription>{job.errorMessage ?? "Unknown error."}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={handleRetry} disabled={retrying}>
                {retrying ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RotateCcw data-icon="inline-start" />
                )}
                Retry
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Upload another
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Uploading → Transcribing → Analysing → Ready, with the current step spinning.
function ProgressSteps({ current }: { current: number }) {
  const finished = current === STEPS.length - 1;
  return (
    <ol className="flex flex-col gap-2" aria-label="Progress">
      {STEPS.map((label, index) => {
        const done = index < current || finished;
        const active = index === current && !finished;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("flex items-center gap-2 text-sm", !done && !active && "text-muted-foreground")}
          >
            {done ? (
              <Check className="size-4 text-primary" />
            ) : active ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Circle className="size-4" />
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

// The same rules as the server (src/lib/validation.ts), checked first to skip a pointless upload.
function checkFile(value: FormDataEntryValue | null, accept: string, maxUploadMb: number): string | null {
  if (!(value instanceof File) || value.size === 0) return "Choose a recording to upload.";
  const extension = value.name.slice(value.name.lastIndexOf(".")).toLowerCase();
  if (!accept.split(",").includes(extension)) {
    return `That file type is not supported. Use one of: ${accept.replaceAll(",", ", ")}.`;
  }
  if (value.size > maxUploadMb * BYTES_PER_MB) {
    return `The file is ${(value.size / BYTES_PER_MB).toFixed(1)} MB, but the limit is ${maxUploadMb} MB.`;
  }
  return null;
}

// Parses an API response; for an error status, throws with the server's message.
async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as Partial<ApiError> | null)?.error;
    throw new Error(message ?? `The server answered with HTTP ${response.status}.`);
  }
  return body as T;
}

// fetch() rejects with a TypeError when the server cannot be reached at all.
function errorText(error: unknown): string {
  if (error instanceof TypeError) return "Cannot reach the app's server. Check that it is running.";
  return error instanceof Error ? error.message : String(error);
}
