"use client";

// The speaker button under an answer in the chat panel: reads the answer aloud, or stops it. While the
// answer is being read it shows moving bars and "Stop". If the browser refused to start an answer read
// out automatically, "Tap to hear the answer" takes its place. State comes from useSpeech (MeetingChat).
import { Volume2 } from "lucide-react";
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

// Three bars moving like a level meter (still when the user prefers reduced motion).
function SoundBars() {
  return (
    <span aria-hidden data-icon="inline-start" className="flex h-3 items-center gap-0.5">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="h-full w-0.5 animate-sound-bar rounded-full bg-current motion-reduce:animate-none"
          style={{ animationDelay: `${bar * 150}ms` }}
        />
      ))}
    </span>
  );
}
