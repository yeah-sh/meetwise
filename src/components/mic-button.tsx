"use client";

// Voice input for the chat panel (MeetingChat): the mic button next to Send, and VoiceStatus, which
// takes the place of the input hint while recording or transcribing. State comes from useVoiceQuestion.
import { LoaderCircle, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoicePhase, VoiceQuestion } from "@/hooks/use-voice-question";

// The button's accessible name says what pressing it will do now.
const BUTTON_LABELS: Record<VoicePhase, string> = {
  idle: "Ask by voice",
  starting: "Cancel: waiting for the microphone",
  recording: "Stop recording and send",
  transcribing: "Transcribing your question",
};

type MicButtonProps = {
  voice: VoiceQuestion;
  disabled: boolean; // no new recording while an answer is loading; one in progress can still be stopped
};

export function MicButton({ voice, disabled }: MicButtonProps) {
  const { phase } = voice;
  const recording = phase === "recording";
  return (
    <>
      <Button
        type="button"
        variant={recording ? "destructive" : "outline"}
        size={recording ? "default" : "icon"}
        onClick={voice.toggle}
        disabled={phase === "transcribing" || (phase === "idle" && disabled)}
        // Keeps keyboard focus on the button while it is disabled (e.g. during transcription).
        focusableWhenDisabled
        aria-label={BUTTON_LABELS[phase]}
        title={BUTTON_LABELS[phase]}
        className="data-disabled:opacity-50"
      >
        {recording ? (
          <>
            <RecordingDot />
            <span className="tabular-nums">{formatSeconds(voice.elapsed)}</span>
          </>
        ) : phase === "idle" ? (
          <Mic />
        ) : (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" />
        )}
      </Button>
      {/* Always in the page, so screen readers announce each change of phase. */}
      <span role="status" className="sr-only">
        {phase === "starting" && "Starting the microphone."}
        {recording &&
          `Recording. Press the button again to send, or Escape to cancel. It stops after ${voice.maxSeconds} seconds.`}
        {phase === "transcribing" && "Transcribing your question."}
      </span>
    </>
  );
}

// Shown instead of the "Enter to send" hint while the microphone is busy. Cancel does what Escape does.
export function VoiceStatus({ voice }: { voice: VoiceQuestion }) {
  const { phase } = voice;
  return (
    <div className="mr-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        {phase === "starting" && "Starting the microphone…"}
        {phase === "recording" && `Recording · stops at ${formatSeconds(voice.maxSeconds)}`}
        {phase === "transcribing" && "Transcribing…"}
      </span>
      <Button type="button" variant="ghost" size="xs" onClick={voice.cancel} title="Cancel (Esc)" aria-keyshortcuts="Escape">
        <X data-icon="inline-start" />
        Cancel
      </Button>
    </div>
  );
}

// A red dot with a pulsing ring (the ring is left out when the user prefers reduced motion).
function RecordingDot() {
  return (
    <span aria-hidden className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75 motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}

// e.g. 7 -> "0:07"
function formatSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
