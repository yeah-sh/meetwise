// Uploading → Transcribing → Analysing → Ready, with the current step spinning and a hint below.
// Shared by the upload form and the meeting page.
import { Check, Circle, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeetingStatus } from "@/types";

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

export const UPLOADING_STEP = 0;

export function stepForStatus(status: Exclude<MeetingStatus, "FAILED">): number {
  return STEP_INDEX[status];
}

type ProcessingProgressProps = {
  step: number; // UPLOADING_STEP, or stepForStatus(...)
  pollError?: string | null;
};

export function ProcessingProgress({ step, pollError }: ProcessingProgressProps) {
  const finished = step === STEPS.length - 1;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2" aria-label="Progress">
        {STEPS.map((label, index) => {
          const done = index < step || finished;
          const active = index === step && !finished;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={cn("flex items-center gap-2 text-sm", !done && !active && "text-muted-foreground")}
            >
              {done ? (
                <Check className="size-4 text-primary" />
              ) : active ? (
                <LoaderCircle className="size-4 animate-spin text-primary" />
              ) : (
                <Circle className="size-4" />
              )}
              {label}
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {STEP_HINTS[step]}
      </p>
      {pollError && <p className="text-sm text-destructive">{pollError}</p>}
    </div>
  );
}
