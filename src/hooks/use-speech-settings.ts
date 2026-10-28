"use client";

// The chat's read-aloud settings, chosen in its gear popover (ChatSettings) and kept in localStorage:
// whether new answers are read aloud automatically, separately after spoken questions (on by default)
// and after typed ones (off by default); the voice; and the speed.
import { useCallback } from "react";
import { useStoredFlag, useStoredString } from "@/hooks/use-stored-flag";

export const MIN_RATE = 0.75;
export const MAX_RATE = 1.5;

export function useSpeechSettings() {
  const [autoReadSpoken, setAutoReadSpoken] = useStoredFlag("readAloudSpokenAnswers", true);
  const [autoReadTyped, setAutoReadTyped] = useStoredFlag("readAloudTypedAnswers", false);
  const [voiceURI, setVoiceURI] = useStoredString("speechVoice"); // "" = the browser's default voice
  const [savedRate, setSavedRate] = useStoredString("speechRate", "1");
  const rate = clampRate(Number(savedRate));
  const setRate = useCallback((next: number) => setSavedRate(String(clampRate(next))), [setSavedRate]);

  return { autoReadSpoken, setAutoReadSpoken, autoReadTyped, setAutoReadTyped, voiceURI, setVoiceURI, rate, setRate };
}

export type SpeechSettings = ReturnType<typeof useSpeechSettings>;

// The stored text could be anything (e.g. edited by hand), so it is checked like any input.
function clampRate(rate: number): number {
  return Number.isFinite(rate) ? Math.min(MAX_RATE, Math.max(MIN_RATE, rate)) : 1;
}
