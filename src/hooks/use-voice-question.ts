"use client";

// A spoken chat question, from the mic button to text: records it (useVoiceRecorder), sends the
// recording to POST /api/transcribe-question, and passes the text to onText. Escape cancels a
// recording, or a transcription still in progress. Used by the chat panel (MeetingChat).
import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceRecorder, type Recording } from "@/hooks/use-voice-recorder";
import { errorText, readJson } from "@/lib/api-client";
import { MAX_VOICE_SECONDS } from "@/lib/chat-questions";
import type { TranscribedQuestion } from "@/types";

export type VoicePhase = "idle" | "starting" | "recording" | "transcribing";

// Shorter than this is a quick double click with nothing said: not worth a trip to Langflow.
const MIN_SECONDS = 0.5;
const NOT_HEARD = "I couldn't hear a question, please try again.";

// The file extension the server expects for each recorder format (see validateQuestionAudio).
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

export function useVoiceQuestion(onText: (text: string) => void) {
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  async function transcribe({ blob, seconds }: Recording) {
    if (blob.size === 0 || seconds < MIN_SECONDS) {
      setTranscribeError(NOT_HEARD);
      return;
    }
    // A type can carry parameters, e.g. "audio/webm;codecs=opus".
    const extension = EXTENSIONS[blob.type.split(";")[0].trim().toLowerCase()];
    if (!extension) {
      setTranscribeError(`This browser records audio as "${blob.type || "unknown"}", which cannot be transcribed. Type your question instead.`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, `question.${extension}`);
      const response = await fetch("/api/transcribe-question", { method: "POST", body: form, signal: controller.signal });
      const { text } = await readJson<TranscribedQuestion>(response);
      if (!controller.signal.aborted) onTextRef.current(text);
    } catch (failure) {
      if (!controller.signal.aborted) setTranscribeError(errorText(failure));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setTranscribing(false);
      }
    }
  }

  const recorder = useVoiceRecorder({ maxSeconds: MAX_VOICE_SECONDS, onRecorded: transcribe });
  const { isStarting, isRecording, cancel: cancelRecording, clearError: clearRecorderError } = recorder;
  const phase: VoicePhase = isStarting ? "starting" : isRecording ? "recording" : transcribing ? "transcribing" : "idle";

  // Drops the recording, or the transcription in progress (the server still finishes it, unseen).
  const cancel = useCallback(() => {
    cancelRecording();
    abortRef.current?.abort();
    abortRef.current = null;
    setTranscribing(false);
  }, [cancelRecording]);

  // The mic button: starts a recording, or stops it, which sends it for transcription.
  function toggle() {
    if (phase === "idle") {
      setTranscribeError(null);
      void recorder.start();
    } else if (phase !== "transcribing") {
      recorder.stop();
    }
  }

  const clearError = useCallback(() => {
    clearRecorderError();
    setTranscribeError(null);
  }, [clearRecorderError]);

  // Escape anywhere on the page. Not skipped when another handler called preventDefault: the mic
  // button does that for every key while it is disabled during transcription.
  const active = phase !== "idle";
  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") cancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, cancel]);

  useEffect(() => cancel, [cancel]);

  return {
    phase,
    elapsed: recorder.elapsed,
    maxSeconds: MAX_VOICE_SECONDS,
    error: recorder.error ?? transcribeError,
    toggle,
    cancel,
    clearError,
  };
}

export type VoiceQuestion = ReturnType<typeof useVoiceQuestion>;
