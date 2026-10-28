"use client";

// State and API calls for one meeting's chat panel (MeetingChat). The messages shown are the ones the
// database holds: the page's initial list, then the saved messages POST /api/meetings/[id]/chat
// returns. The only local copy is `unsent`, a question the server has not confirmed saving: shown
// while it is being sent, and kept with the error (and Retry) if it never got saved.
import { useState } from "react";
import { errorText, readJson } from "@/lib/api-client";
import type { ChatErrorResponse, ChatMessageView, ChatReply, InputMode } from "@/types";

export type PendingQuestion = { content: string; inputMode: InputMode };

export function useMeetingChat(meetingId: string, initialMessages: ChatMessageView[]) {
  const [messages, setMessages] = useState(initialMessages);
  const [unsent, setUnsent] = useState<PendingQuestion | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatUrl = `/api/meetings/${encodeURIComponent(meetingId)}/chat`;
  const newest = messages.at(-1);
  // What Retry asks again: a question that failed before it was saved, or else the newest saved
  // question if it still has no answer (also after a page reload).
  const retryQuestion: PendingQuestion | null =
    unsent ?? (newest?.role === "USER" ? { content: newest.content, inputMode: newest.inputMode } : null);

  // Sends a question (Phase 7 passes "VOICE" for spoken ones) and adds the saved question and answer.
  async function send(question: string, inputMode: InputMode = "TEXT") {
    const content = question.trim();
    if (!content || sending) return;
    // Asking the newest, unanswered question again: the server answers that saved message instead
    // of saving a copy, so no second bubble is shown for it.
    const askingSavedAgain = newest?.role === "USER" && newest.content === content;
    setUnsent(askingSavedAgain ? null : { content, inputMode });
    setError(null);
    setSending(true);
    try {
      const response = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content, inputMode }),
      });
      const body: Partial<ChatReply & ChatErrorResponse> | null = await response.json().catch(() => null);
      // The question is saved even when answering failed (502): show the saved copy from now on.
      const savedQuestion = body?.userMessage;
      if (savedQuestion) {
        setMessages((list) => upsert(list, savedQuestion));
        setUnsent(null);
      }
      const answer = body?.assistantMessage;
      if (!response.ok || !answer) {
        throw new Error(body?.error ?? `The server answered with HTTP ${response.status}.`);
      }
      setMessages((list) => upsert(list, answer));
    } catch (sendFailure) {
      setError(errorText(sendFailure));
    } finally {
      setSending(false);
    }
  }

  // Deletes the whole chat. Returns an error message, or null when it was cleared.
  async function clear(): Promise<string | null> {
    try {
      await readJson<null>(await fetch(chatUrl, { method: "DELETE" }));
      setMessages([]);
      setUnsent(null);
      setError(null);
      return null;
    } catch (clearFailure) {
      return errorText(clearFailure);
    }
  }

  return { messages, unsent, sending, error, retryQuestion: sending ? null : retryQuestion, send, clear };
}

// Adds a message, or replaces the one with the same id (a retried question comes back with its own id).
function upsert(list: ChatMessageView[], message: ChatMessageView): ChatMessageView[] {
  return list.some((item) => item.id === message.id)
    ? list.map((item) => (item.id === message.id ? message : item))
    : [...list, message];
}
