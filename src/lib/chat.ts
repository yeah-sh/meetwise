// Database and Langflow steps behind /api/meetings/[id]/chat.
// The database is the source of truth for the chat the panel shows. Langflow keeps its own copy of
// the conversation (its Chat Input and Answer Output store each turn under session_id = meeting id),
// but that copy only feeds the "conversation so far" part of the Q&A prompt.
import "server-only";
import { prisma } from "@/lib/db";
import { askMeeting, LangflowError } from "@/lib/langflow";
import { fitTranscript, SMALL_TRANSCRIPT_BUDGET_CHARS, TRANSCRIPT_BUDGET_CHARS } from "@/lib/transcript-excerpt";
import type { ChatMessage, InputMode, Prisma } from "@/generated/prisma/client";
import type { ChatMessageView } from "@/types";

export const CHAT_MESSAGE_SELECT = {
  id: true,
  role: true,
  content: true,
  inputMode: true,
  createdAt: true,
} satisfies Prisma.ChatMessageSelect;

export function toChatMessageView(message: Pick<ChatMessage, keyof typeof CHAT_MESSAGE_SELECT>): ChatMessageView {
  return { ...message, createdAt: message.createdAt.toISOString() };
}

// The meeting's chat, oldest first.
export async function listChatMessages(meetingId: string): Promise<ChatMessageView[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { meetingId },
    orderBy: { createdAt: "asc" },
    select: CHAT_MESSAGE_SELECT,
  });
  return messages.map(toChatMessageView);
}

// Saves the question as a USER message. When the newest message is this same question still
// without an answer (an earlier attempt failed and the user pressed Retry), that message is reused
// instead of saving the question twice.
export async function saveQuestion(meetingId: string, question: string, inputMode: InputMode): Promise<ChatMessageView> {
  const newest = await prisma.chatMessage.findFirst({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
    select: CHAT_MESSAGE_SELECT,
  });
  if (newest?.role === "USER" && newest.content === question) return toChatMessageView(newest);

  const saved = await prisma.chatMessage.create({
    data: { meetingId, role: "USER", content: question, inputMode },
    select: CHAT_MESSAGE_SELECT,
  });
  return toChatMessageView(saved);
}

export async function saveAnswer(meetingId: string, answer: string): Promise<ChatMessageView> {
  const saved = await prisma.chatMessage.create({
    data: { meetingId, role: "ASSISTANT", content: answer },
    select: CHAT_MESSAGE_SELECT,
  });
  return toChatMessageView(saved);
}

type MeetingToAsk = { id: string; transcript: string; summary: string | null };

// Asks the Q&A flow about one meeting and returns a non-empty answer. Keeps the transcript within the
// model's limits (see transcript-excerpt.ts). Throws a LangflowError when Langflow fails.
export async function answerQuestion(meeting: MeetingToAsk, question: ChatMessageView): Promise<string> {
  // Only used to pick passages from a very long transcript: a follow-up such as "who owns that?"
  // has few words of its own, so the previous question's words help find its topic.
  const previous = await prisma.chatMessage.findFirst({
    where: { meetingId: meeting.id, role: "USER", createdAt: { lt: new Date(question.createdAt) } },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  const searchText = previous ? `${question.content}\n${previous.content}` : question.content;

  const ask = (maxChars: number) =>
    askMeeting({
      meetingId: meeting.id, // sent as session_id, so Langflow's memory stays per meeting
      question: question.content,
      transcript: fitTranscript(meeting.transcript, searchText, maxChars),
      summary: meeting.summary,
    });

  let answer: string;
  try {
    answer = await ask(TRANSCRIPT_BUDGET_CHARS);
  } catch (error) {
    // Groq's free tier caps tokens per minute far below the model's context window and then answers
    // "request too large"; a much shorter excerpt usually fits. Langflow has already stored the
    // question, so its memory holds it twice; that copy only helps resolve follow-up questions.
    const canShrink =
      error instanceof LangflowError &&
      error.code === "TOO_LARGE" &&
      meeting.transcript.length > SMALL_TRANSCRIPT_BUDGET_CHARS;
    if (!canShrink) throw error;
    console.warn(`[chat] Meeting ${meeting.id}: the request was too large; asking again with a shorter transcript excerpt.`);
    answer = await ask(SMALL_TRANSCRIPT_BUDGET_CHARS);
  }

  // askMeeting already rejects an empty output; checked here as well because an empty answer
  // must never be saved.
  if (!answer.trim()) throw new LangflowError("BAD_RESPONSE", "Langflow returned an empty answer.");
  return answer.trim();
}
