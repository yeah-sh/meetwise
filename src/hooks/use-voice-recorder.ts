"use client";

// Records audio from the microphone with the browser's MediaRecorder API (for spoken chat questions).
// start() asks for microphone permission the first time (the browser shows its prompt), stop() ends the
// recording and passes it to onRecorded, and cancel() throws it away. Recording also stops by itself
// after maxSeconds.
//
// Browsers only allow microphone access on secure origins: https:// pages, and http://localhost, which
// counts as secure, so `npm run dev` works. Opened over plain http:// from another address (e.g.
// http://192.168.1.20:3000 on a phone), navigator.mediaDevices is undefined and start() explains that.
import { useCallback, useEffect, useRef, useState } from "react";

// Tried in this order. Chrome and Edge record WebM/Opus, Firefox WebM or Ogg, Safari MP4 (AAC);
// the Groq Whisper component accepts them all.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4", "audio/wav"];

const CANNOT_RECORD = "This browser could not start recording. Type your question instead.";

export type Recording = { blob: Blob; seconds: number };

type RecorderOptions = { maxSeconds: number; onRecorded: (recording: Recording) => void };

// One press of "record": the microphone stream once it is granted, and its recorder.
type Session = { stream?: MediaStream; recorder?: MediaRecorder; timer?: number; discard: boolean };

export function useVoiceRecorder({ maxSeconds, onRecorded }: RecorderOptions) {
  const [isStarting, setIsStarting] = useState(false); // waiting for the microphone (or the permission prompt)
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0); // whole seconds
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const onRecordedRef = useRef(onRecorded);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  // Releases the microphone (the browser's recording indicator goes away) and resets the state.
  // Safe to call more than once.
  const finish = useCallback((session: Session) => {
    window.clearInterval(session.timer);
    session.stream?.getTracks().forEach((track) => track.stop());
    if (sessionRef.current !== session) return;
    sessionRef.current = null;
    setIsStarting(false);
    setIsRecording(false);
    setElapsed(0);
  }, []);

  const start = useCallback(async () => {
    if (sessionRef.current) return; // already starting or recording
    setError(null);
    const unsupported = unsupportedReason();
    if (unsupported) {
      setError(unsupported);
      return;
    }

    const session: Session = { discard: false };
    sessionRef.current = session;
    setIsStarting(true);
    try {
      // The first call shows the browser's permission prompt; once allowed, later calls resolve at once.
      session.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (failure) {
      if (sessionRef.current === session) setError(microphoneError(failure));
      finish(session);
      return;
    }
    // Cancelled (or unmounted) while waiting: finish() just releases the microphone.
    if (sessionRef.current !== session) {
      finish(session);
      return;
    }

    let recorder: MediaRecorder;
    try {
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(session.stream, mimeType ? { mimeType } : undefined);
    } catch {
      setError(CANNOT_RECORD);
      finish(session);
      return;
    }
    session.recorder = recorder;
    const chunks: Blob[] = [];
    const startedAt = performance.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    // The browser stops the recorder after an error (e.g. the microphone was unplugged).
    recorder.onerror = () => {
      session.discard = true;
      setError("Recording stopped because of a microphone problem. Please try again.");
      finish(session);
    };
    recorder.onstop = () => {
      finish(session);
      if (session.discard) return;
      const type = recorder.mimeType || chunks[0]?.type || "";
      onRecordedRef.current({ blob: new Blob(chunks, { type }), seconds: (performance.now() - startedAt) / 1000 });
    };

    try {
      recorder.start(); // without a timeslice, all audio arrives in one dataavailable event when it stops
    } catch {
      session.discard = true;
      setError(CANNOT_RECORD);
      finish(session);
      return;
    }
    setIsStarting(false);
    setIsRecording(true);
    session.timer = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000;
      setElapsed(Math.min(Math.floor(seconds), maxSeconds));
      if (seconds >= maxSeconds && recorder.state === "recording") recorder.stop();
    }, 250);
  }, [finish, maxSeconds]);

  // Ends the recording and passes it to onRecorded. While still waiting for the microphone, cancels instead.
  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (session?.recorder?.state === "recording") session.recorder.stop();
    else if (session) {
      session.discard = true;
      finish(session);
    }
  }, [finish]);

  // Ends the recording (or the wait for the microphone) without keeping anything.
  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.discard = true;
    if (session.recorder?.state === "recording") session.recorder.stop();
    finish(session);
  }, [finish]);

  const clearError = useCallback(() => setError(null), []);

  // Never leave the microphone on after the chat panel goes away.
  useEffect(() => cancel, [cancel]);

  return { isStarting, isRecording, elapsed, error, start, stop, cancel, clearError };
}

function unsupportedReason(): string | null {
  if (!window.isSecureContext) {
    return "The microphone only works on a secure page. Open the app at http://localhost:3000 or over https://.";
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return "This browser cannot record audio. Use a recent Chrome, Edge, Firefox or Safari, or type your question.";
  }
  return null;
}

// getUserMedia rejects with a DOMException whose name says why.
function microphoneError(failure: unknown): string {
  const name = failure instanceof DOMException ? failure.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    // Chrome and Edge say "Permission denied by system" when Windows blocks the browser itself.
    if (failure instanceof DOMException && /system/i.test(failure.message)) {
      return "Windows is blocking the microphone for this browser. Allow it in Settings > Privacy & security > Microphone, then try again.";
    }
    return "Microphone access is blocked. Allow it for this site with the icon in the address bar, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found. Connect one, then try again.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The microphone could not be started. Another app may be using it.";
  }
  return "The microphone could not be started. Please try again.";
}
