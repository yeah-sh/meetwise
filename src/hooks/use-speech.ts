"use client";

// Reads chat answers aloud with the browser's own text-to-speech (window.speechSynthesis): free, and
// nothing goes to the server. speak() turns the Markdown answer into short plain pieces
// (lib/speech-text.ts) and says them one after another, so a new voice or speed applies from the next
// sentence. Only one answer speaks at a time: speak() replaces whatever is being read. Speech stops
// when the chat panel goes away. Where speechSynthesis is missing, `supported` is false and the panel
// shows no speech controls. Used by the chat panel (MeetingChat).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speechPieces } from "@/lib/speech-text";

// Why an answer was not read aloud: "blocked" when the browser refused to speak without a recent
// click (the panel then offers "Tap to hear the answer"), "failed" for anything else, such as an
// online voice while offline.
export type SpeechProblem = "blocked" | "failed";

// An answer read out automatically that has not started after this long counts as blocked: some
// browsers (Safari) stay silent instead of reporting it.
const AUTO_START_TIMEOUT_MS = 4000;

// One answer being read.
type Session = {
  id: string; // the message's id
  pieces: string[];
  next: number; // index of the next piece to say
  started: boolean; // the first piece has started playing
  done: boolean;
  utterance?: SpeechSynthesisUtterance; // see sayNext
  timer?: number;
};

type VoiceChoice = { voice?: SpeechSynthesisVoice; rate: number };

export function useSpeech({ voiceURI, rate }: { voiceURI: string; rate: number }) {
  const supported = useSyncExternalStore(subscribeToNothing, isSupported, () => false);
  const voices = useSyncExternalStore(subscribeToVoices, getVoices, () => NO_VOICES);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ id: string; kind: SpeechProblem } | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const aliveRef = useRef(false); // false once the panel has gone away: a late answer is not read
  const choiceRef = useRef<VoiceChoice>({ rate });

  useEffect(() => {
    choiceRef.current = { voice: voices.find((voice) => voice.voiceURI === voiceURI), rate };
  });

  const finish = useCallback((session: Session, failure?: SpeechProblem) => {
    if (session.done) return;
    session.done = true;
    window.clearTimeout(session.timer);
    sessionRef.current = null;
    setSpeakingId(null);
    if (failure) setProblem({ id: session.id, kind: failure });
  }, []);

  const stop = useCallback(() => {
    if (sessionRef.current) finish(sessionRef.current);
    setProblem(null);
    if (isSupported()) window.speechSynthesis.cancel();
  }, [finish]);

  // Reads an answer aloud. `auto` marks one the user did not ask to hear just now (a new answer read
  // out automatically), which the browser may refuse.
  const speak = useCallback(
    (id: string, markdown: string, { auto = false }: { auto?: boolean } = {}) => {
      if (!aliveRef.current || !isSupported()) return;
      stop();
      const pieces = speechPieces(markdown);
      if (pieces.length === 0) return;
      // Chrome and Edge refuse to speak on a page the user has not clicked or typed in yet.
      if (navigator.userActivation?.hasBeenActive === false) {
        setProblem({ id, kind: "blocked" });
        return;
      }

      const session: Session = { id, pieces, next: 0, started: false, done: false };
      sessionRef.current = session;
      setSpeakingId(id);
      if (auto) {
        session.timer = window.setTimeout(() => {
          if (session.started || session.done) return;
          finish(session, "blocked");
          window.speechSynthesis.cancel();
        }, AUTO_START_TIMEOUT_MS);
      }
      sayNext(session, () => choiceRef.current, (failure) => finish(session, failure));
    },
    [finish, stop],
  );

  // Silence when the panel goes away: another page of the app (Next.js hides the page, which runs
  // this cleanup), or the tab being closed or reloaded (pagehide; Chrome would otherwise keep talking).
  useEffect(() => {
    aliveRef.current = true;
    window.addEventListener("pagehide", stop);
    return () => {
      aliveRef.current = false;
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [stop]);

  return { supported, voices, speakingId, isSpeaking: speakingId !== null, problem, speak, stop };
}

export type Speech = ReturnType<typeof useSpeech>;

// Says the session's pieces one after another, each with the voice and speed chosen at that moment,
// then calls finish (with the reason, if speech failed). The utterance is kept on the session: Chrome
// can garbage-collect one that nothing references, and then its "end" event never fires.
function sayNext(session: Session, choice: () => VoiceChoice, finish: (failure?: SpeechProblem) => void) {
  if (session.done) return;
  const text = session.pieces[session.next];
  session.next += 1;
  if (text === undefined) {
    finish();
    return;
  }
  const { voice, rate } = choice();
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = rate;
  utterance.onstart = () => {
    session.started = true;
  };
  utterance.onend = () => sayNext(session, choice, finish);
  utterance.onerror = (event) => {
    // "interrupted" and "canceled": speechSynthesis.cancel() cut it short, which is not a failure.
    // After stop() or a newer speak() the session is already done, and finish() does nothing.
    if (event.error === "interrupted" || event.error === "canceled") finish();
    else finish(event.error === "not-allowed" ? "blocked" : "failed");
  };
  session.utterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function isSupported(): boolean {
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
}

function subscribeToNothing() {
  return () => {};
}

const NO_VOICES: SpeechSynthesisVoice[] = [];
let voiceCache: SpeechSynthesisVoice[] | null = null;

// getVoices() can be empty at first: Chrome loads its voices after the page, and Edge adds its online
// voices a moment later. "voiceschanged" says when the list has changed.
function subscribeToVoices(onChange: () => void) {
  if (!isSupported()) return () => {};
  const refresh = () => {
    voiceCache = null;
    onChange();
  };
  refresh(); // the list may have changed between the first render and this subscription
  window.speechSynthesis.addEventListener("voiceschanged", refresh);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
}

function getVoices(): SpeechSynthesisVoice[] {
  if (!isSupported()) return NO_VOICES;
  voiceCache ??= sortVoices(window.speechSynthesis.getVoices());
  return voiceCache;
}

// English voices first (the browser's own variant, e.g. en-GB, before the other English ones), then
// the rest by language, by name within each. Duplicates, which some browsers list, are dropped.
function sortVoices(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const own = navigator.language.toLowerCase();
  const rank = (voice: SpeechSynthesisVoice) =>
    !isEnglishVoice(voice) ? 2 : voiceLang(voice).toLowerCase() === own ? 0 : 1;
  const unique = [...new Map(list.map((voice) => [voice.voiceURI, voice] as const)).values()];
  return unique.sort(
    (a, b) => rank(a) - rank(b) || voiceLang(a).localeCompare(voiceLang(b)) || a.name.localeCompare(b.name),
  );
}

// e.g. "en-GB" (Android writes "en_GB").
export function voiceLang(voice: SpeechSynthesisVoice): string {
  return voice.lang.replace("_", "-");
}

export function isEnglishVoice(voice: SpeechSynthesisVoice): boolean {
  return /^en(-|$)/i.test(voiceLang(voice));
}
