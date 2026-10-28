"use client";

// The chat panel on /meetings/[id] (right column on desktop, below the report on phones). Questions go
// to POST /api/meetings/[id]/chat, where the Q&A flow in Langflow answers them only from this meeting's
// transcript. Shows the saved chat with the newest message in view, suggested questions while the chat
// is empty, a typing indicator while waiting, and failures inline with Retry. Questions can also be
// spoken with the mic button: they are transcribed, then sent with inputMode "VOICE". Answers can be
// read aloud by the browser (speaker button on each answer, settings behind the gear); a new answer
// is read out automatically after a spoken question unless the settings say otherwise.
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, MessagesSquare, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { ChatMessage, TypingIndicator } from "@/components/chat-message";
import { ChatSettings } from "@/components/chat-settings";
import { ClearChatButton } from "@/components/clear-chat-button";
import { MicButton, VoiceStatus } from "@/components/mic-button";
import type { AnswerSpeech } from "@/components/speak-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMeetingChat, type PendingQuestion } from "@/hooks/use-meeting-chat";
import { useSpeech } from "@/hooks/use-speech";
import { useSpeechSettings } from "@/hooks/use-speech-settings";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { useVoiceQuestion } from "@/hooks/use-voice-question";
import { MAX_QUESTION_LENGTH } from "@/lib/chat-questions";
import { cn } from "@/lib/utils";
import type { ChatMessageView, InputMode, MeetingStatus } from "@/types";

// The character count appears once a question gets this close to the limit.
const COUNT_FROM = MAX_QUESTION_LENGTH - 100;
// localStorage key of the "Review before sending" checkbox.
const REVIEW_VOICE_KEY = "reviewVoiceQuestions";

type MeetingChatProps = {
  meetingId: string;
  status: MeetingStatus;
  initialMessages: ChatMessageView[]; // oldest first, as saved in the database
  suggestions: string[]; // from suggestQuestions() in lib/chat-questions.ts
};

export function MeetingChat({ status, ...chatProps }: MeetingChatProps) {
  return (
    <aside
      aria-label="Chat with this meeting"
      className="flex h-[min(40rem,85dvh)] flex-col overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]"
    >
      {status === "READY" ? <Chat {...chatProps} /> : <ChatUnavailable failed={status === "FAILED"} />}
    </aside>
  );
}

function Chat({ meetingId, initialMessages, suggestions }: Omit<MeetingChatProps, "status">) {
  const speechSettings = useSpeechSettings();
  const speech = useSpeech(speechSettings);
  // Any new question, typed or spoken, silences the answer being read.
  const { messages, unsent, sending, error, retryQuestion, send, clear } = useMeetingChat(meetingId, initialMessages, {
    onSend: speech.stop,
    onAnswer: readAloudIfWanted,
  });
  const [draft, setDraft] = useState("");
  // "VOICE" while the box holds a transcribed question, so it is saved as asked by voice even if edited.
  const [draftMode, setDraftMode] = useState<InputMode>("TEXT");
  const [reviewVoice, setReviewVoice] = useStoredFlag(REVIEW_VOICE_KEY);
  const voice = useVoiceQuestion(handleTranscribed, speech.stop);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrolledOnce = useRef(false);
  const refocusInput = useRef(false);
  const hintId = useId();

  // Keep the newest message in view: jump there on the first render, then scroll smoothly as
  // questions, answers, the typing indicator or an error appear. Only the list scrolls, never the page.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: scrolledOnce.current ? "smooth" : "auto" });
    scrolledOnce.current = true;
  }, [messages, unsent, sending, error]);

  // The input is disabled while waiting, which takes focus away from it; give it back afterwards.
  useEffect(() => {
    if (sending || !refocusInput.current) return;
    refocusInput.current = false;
    inputRef.current?.focus({ preventScroll: true });
  }, [sending]);

  const length = draft.trim().length;
  const tooLong = length > MAX_QUESTION_LENGTH;
  const canSend = !sending && length > 0 && !tooLong;

  function ask(question: PendingQuestion | string) {
    refocusInput.current = true;
    if (typeof question === "string") void send(question);
    else void send(question.content, question.inputMode);
  }

  function submitDraft() {
    if (!canSend) return;
    ask({ content: draft, inputMode: draftMode });
    setDraft("");
    setDraftMode("TEXT");
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!value.trim()) setDraftMode("TEXT");
    voice.clearError();
  }

  // A spoken question, as text. It is sent at once with inputMode "VOICE", unless "Review before
  // sending" is on, the box already held typed text (the two are joined), an answer is still loading,
  // or it is too long: then it waits in the box for editing and Send.
  function handleTranscribed(text: string) {
    const typed = draft.trim();
    const question = typed ? `${typed} ${text}` : text;
    if (!reviewVoice && !typed && !sending && question.length <= MAX_QUESTION_LENGTH) {
      // Not ask(): focus stays on the mic button, ready for the next spoken question.
      void send(question, "VOICE");
      return;
    }
    setDraft(question);
    setDraftMode("VOICE");
    inputRef.current?.focus({ preventScroll: true });
  }

  // New answers only (not the saved chat on page load), after the kind of question the settings ask
  // for: by default only spoken ones.
  function readAloudIfWanted(answer: ChatMessageView, inputMode: InputMode) {
    const wanted = inputMode === "VOICE" ? speechSettings.autoReadSpoken : speechSettings.autoReadTyped;
    if (wanted) speech.speak(answer.id, answer.content, { auto: true });
  }

  // The speaker button's state for an answer; none where the browser cannot speak.
  function speechFor(message: ChatMessageView): AnswerSpeech | undefined {
    if (!speech.supported || message.role !== "ASSISTANT") return undefined;
    const speaking = speech.speakingId === message.id;
    return {
      speaking,
      problem: speech.problem?.id === message.id ? speech.problem.kind : null,
      onToggle: () => (speaking ? speech.stop() : speech.speak(message.id, message.content)),
    };
  }

  // The bubble being read (and its Stop button) is about to disappear.
  function clearChat() {
    speech.stop();
    return clear();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitDraft();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends and Shift+Enter starts a new line. An Enter that confirms an IME composition
    // (e.g. typing Japanese) is left alone.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitDraft();
    }
  }

  const empty = messages.length === 0 && !unsent;

  return (
    <>
      <PanelHeader>
        {speech.supported && <ChatSettings settings={speechSettings} speech={speech} />}
        <ClearChatButton onClear={clearChat} disabled={sending || messages.length === 0} />
      </PanelHeader>

      <div
        ref={listRef}
        role="log"
        aria-label="Chat messages"
        tabIndex={0}
        className="flex-1 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {empty ? (
          <EmptyChat suggestions={suggestions} onPick={ask} />
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} speech={speechFor(message)} />
            ))}
            {unsent && <ChatMessage message={{ role: "USER", ...unsent }} note={sending ? "Sending…" : "Not sent"} />}
            {sending && <TypingIndicator />}
          </ol>
        )}
        {(error || retryQuestion) && (
          <ChatProblem error={error} onRetry={retryQuestion ? () => ask(retryQuestion) : undefined} />
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t p-3">
        {voice.error && (
          <p role="alert" className="flex gap-1.5 text-xs text-pretty text-destructive">
            <CircleAlert className="mt-px size-3.5 shrink-0" />
            {voice.error}
          </p>
        )}
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={1}
          placeholder="Ask about this meeting…"
          aria-label="Your question"
          aria-describedby={hintId}
          aria-invalid={tooLong || undefined}
          className="max-h-36 min-h-10 resize-none"
        />
        <div className="flex items-center gap-2">
          {voice.phase === "idle" ? (
            <p id={hintId} className={cn("mr-auto text-xs text-muted-foreground", tooLong && "text-destructive")}>
              {tooLong
                ? `${length.toLocaleString("en-GB")}/${MAX_QUESTION_LENGTH.toLocaleString("en-GB")}: please shorten your question.`
                : length >= COUNT_FROM
                  ? `${length.toLocaleString("en-GB")}/${MAX_QUESTION_LENGTH.toLocaleString("en-GB")} characters`
                  : "Enter to send, Shift+Enter for a new line"}
            </p>
          ) : (
            <VoiceStatus voice={voice} />
          )}
          <MicButton voice={voice} disabled={sending} />
          <Button type="submit" disabled={!canSend}>
            {sending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <SendHorizontal data-icon="inline-start" />}
            Send
          </Button>
        </div>
        {/* Base UI's checkbox is labelled by the <label> around it. */}
        <Label className="w-fit text-xs font-normal text-muted-foreground">
          <Checkbox checked={reviewVoice} onCheckedChange={(checked) => setReviewVoice(checked)} />
          <span>
            Review <span className="sr-only">spoken questions </span>before sending
          </span>
        </Label>
      </form>
    </>
  );
}

function PanelHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <MessagesSquare className="size-4" />
      </span>
      <div className="mr-auto min-w-0">
        <h2 className="leading-tight font-medium">Chat with this meeting</h2>
        <p className="text-xs text-muted-foreground">Answers come only from its transcript</p>
      </div>
      {children}
    </div>
  );
}

function EmptyChat({ suggestions, onPick }: { suggestions: string[]; onPick: (question: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Ask anything about this meeting</p>
        <p className="text-pretty text-muted-foreground">Type a question below, or start with one of these:</p>
      </div>
      <ul aria-label="Suggested questions" className="flex flex-wrap justify-center gap-2">
        {suggestions.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A failed send, or (e.g. after a reload) a saved question that never got its answer.
function ChatProblem({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  return (
    <div
      role={error ? "alert" : undefined}
      className={cn(
        "mt-4 flex flex-col items-start gap-2 rounded-lg px-3 py-2.5",
        error ? "bg-destructive/10 text-destructive" : "bg-muted/60 text-muted-foreground",
      )}
    >
      <p className="flex gap-2 text-pretty break-words">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {error ?? "This question has no answer yet."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw data-icon="inline-start" />
          Retry
        </Button>
      )}
    </div>
  );
}

function ChatUnavailable({ failed }: { failed: boolean }) {
  return (
    <>
      <PanelHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        {failed ? (
          <CircleAlert className="size-5 text-muted-foreground" />
        ) : (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
        )}
        <p className="font-medium">{failed ? "Chat is not available" : "The chat opens when the report is ready"}</p>
        <p className="max-w-64 text-pretty text-muted-foreground">
          {failed
            ? "Processing failed. Retry it, and you can ask questions once the report is ready."
            : "Then you can ask questions about this meeting and get answers from its transcript."}
        </p>
      </div>
    </>
  );
}
