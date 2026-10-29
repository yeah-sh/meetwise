// One message in the meeting chat (MeetingChat): the user's question as plain text on the right,
// or the assistant's answer as Markdown on the left, with its speaker button where the browser can
// speak. Also the "answering…" indicator.
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { Mic } from "lucide-react";
import { WaveDivider } from "@/components/brand/wave-divider";
import { SpeakButton, type AnswerSpeech } from "@/components/speak-button";
import { cn } from "@/lib/utils";
import type { ChatMessageView } from "@/types";

// In the browser's time zone, e.g. "29 Oct, 14:05". The server renders the panel first in its own
// time zone, which can differ, hence suppressHydrationWarning on <time>.
const timeFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type ChatMessageProps = {
  message: Pick<ChatMessageView, "role" | "content" | "inputMode"> & { createdAt?: string };
  note?: string; // shown instead of the time for a question not saved yet, e.g. "Sending…"
  speech?: AnswerSpeech; // answers only, and only where the browser can speak
};

export function ChatMessage({ message, note, speech }: ChatMessageProps) {
  const isUser = message.role === "USER";
  // A new answer settles in (fades and rises) as it mounts. Only the last item in the list: on page
  // load that keeps the saved chat still apart from its latest answer.
  return (
    <li
      className={cn(
        "flex max-w-[88%] flex-col gap-1",
        isUser ? "items-end self-end" : "items-start self-start motion-safe:last:animate-settle-in",
      )}
    >
      <span className="sr-only">{isUser ? "You asked:" : "MeetWise answered:"}</span>
      {/* The bubble is sized to its content. max-w-full keeps a long code line inside it (the code
          block scrolls instead), and wrap-anywhere lets a long URL or word wrap: break-words alone
          still lets it set the bubble's minimum width and push it past the panel. */}
      <div
        className={cn(
          "max-w-full min-w-0 rounded-2xl px-3.5 py-2.5 wrap-anywhere",
          isUser ? "rounded-br-md bg-primary whitespace-pre-wrap text-primary-foreground" : "rounded-bl-md bg-muted",
          speech?.speaking && "ring-2 ring-primary/40",
        )}
      >
        {isUser ? message.content : <AnswerMarkdown text={message.content} />}
      </div>
      <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        {message.inputMode === "VOICE" && (
          <>
            <Mic className="size-3" />
            <span className="sr-only">Asked by voice,</span>
          </>
        )}
        {note ??
          (message.createdAt && (
            <time dateTime={message.createdAt} suppressHydrationWarning>
              {timeFormat.format(new Date(message.createdAt))}
            </time>
          ))}
        {speech && <SpeakButton {...speech} />}
      </div>
    </li>
  );
}

export function TypingIndicator() {
  return (
    <li className="self-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3.5">
        <span className="sr-only">MeetWise is answering…</span>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            aria-hidden
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-none"
            style={{ animationDelay: `${dot * 150}ms` }}
          />
        ))}
      </div>
    </li>
  );
}

// Answers are Markdown written by the model. react-markdown turns it into React elements and never
// uses innerHTML: raw HTML in an answer is shown as plain text, and link URLs with unsafe protocols
// (javascript: and the like) are removed by its default urlTransform. Images are dropped, so an answer
// cannot make the browser load an outside URL.
function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Markdown components={MARKDOWN_COMPONENTS} disallowedElements={["img"]}>
        {text}
      </Markdown>
    </div>
  );
}

// Headings would be too loud inside a bubble, so they become bold lines.
function Heading({ children }: { children?: ReactNode }) {
  return <p className="font-semibold">{children}</p>;
}

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} className="flex list-decimal flex-col gap-1 pl-5">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-foreground/10 p-2.5 [&_code]:bg-transparent [&_code]:p-0">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-foreground/20 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <WaveDivider className="text-foreground/15" />,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
};
