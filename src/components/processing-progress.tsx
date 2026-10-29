// Uploading → Transcribing → Analysing → Ready, with the current step marked and a hint below. Above
// the steps, the waveform fills with the brand colour as they pass and its bars move while work is
// under way. Shared by the upload form and the meeting page.
import { Check, Circle } from "lucide-react";
import { Waveform } from "@/components/brand/waveform";
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

// How much of the waveform is coloured at each step: halfway through the current step, all of it when
// ready. Written out in full so Tailwind can find the class names.
const WAVE_FILL = [
  "[clip-path:inset(0_87.5%_0_0)]",
  "[clip-path:inset(0_62.5%_0_0)]",
  "[clip-path:inset(0_37.5%_0_0)]",
  "[clip-path:inset(0_0_0_0)]",
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
      <ProgressWave step={step} finished={finished} />
      <ol className="flex flex-col gap-2" aria-label="Progress">
        {STEPS.map((label, index) => {
          const done = index < step || finished;
          const active = index === step && !finished;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-sm",
                active && "font-medium",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="size-4 text-primary" />
              ) : active ? (
                // A still dot: the waveform above carries the motion.
                <span aria-hidden className="flex size-4 items-center justify-center">
                  <span className="size-2 rounded-full bg-primary ring-4 ring-primary/20" />
                </span>
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

// Two copies of the waveform: a pale one, and over it the coloured one, clipped to the share of the
// work done. Both move together so the pale bars never show behind the coloured ones. Decorative:
// the steps below say the same in words.
function ProgressWave({ step, finished }: { step: number; finished: boolean }) {
  const moving = !finished && "wave-moving";
  return (
    <div aria-hidden className="relative w-fit">
      <Waveform width={152} height={44} className={cn("text-primary/20", moving)} />
      <Waveform
        width={152}
        height={44}
        className={cn(
          "absolute inset-0 text-primary transition-[clip-path] duration-300 ease-out motion-reduce:transition-none",
          WAVE_FILL[step],
          moving,
        )}
      />
    </div>
  );
}
