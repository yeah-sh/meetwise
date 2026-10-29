"use client";

// The speaker button under an answer in the chat panel: reads the answer aloud, or stops it. While the
// answer is being read it shows the moving waveform and "Stop". If the browser refused to start an answer
// read out automatically, "Tap to hear the answer" takes its place. State comes from useSpeech (MeetingChat).
import { Volume2 } from "lucide-react";
import { WaveformMark } from "@/components/brand/waveform";
import { Button } from "@/components/ui/button";
import type { SpeechProblem } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

export type AnswerSpeech = { speaking: boolean; problem: SpeechProblem | null; onToggle: () => void };

export function SpeakButton({ speaking, problem, onToggle }: AnswerSpeech) {
  if (problem === "blocked") {
    return (
      <Button variant="outline" size="xs" onClick={onToggle}>
        <Volume2 data-icon="inline-start" />
        Tap to hear the answer
      </Button>
    );
  }

  // The accessible name says what pressing it will do now; it contains the visible "Stop".
  const label = speaking ? "Stop reading aloud" : "Read aloud";
  return (
    <>
      <Button
        variant="ghost"
        size={speaking ? "xs" : "icon-xs"}
        onClick={onToggle}
        aria-label={label}
        title={label}
        className={cn(speaking && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary")}
      >
        {speaking ? (
          <>
            <SoundBars />
            Stop
          </>
        ) : (
          <Volume2 />
        )}
      </Button>
      {problem === "failed" && (
        <span role="alert" className="text-destructive">
          Could not read it aloud. Try another voice in the chat settings.
        </span>
      )}
    </>
  );
}

// The waveform mark with its bars moving like a level meter (still when the user prefers reduced
// motion). The size-3 class keeps the button's own icon size rule from resizing it.
function SoundBars() {
  return (
    <span aria-hidden data-icon="inline-start" className="flex">
      <WaveformMark width={12} height={12} className="size-3 wave-moving" />
    </span>
  );
}
