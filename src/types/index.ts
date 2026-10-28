// Shared TypeScript types: meetings, report sections, chat messages.
// Safe for client components: the enum types come from Prisma's browser-safe enums file.
import type { ChatRole, InputMode, MeetingStatus } from "@/generated/prisma/enums";

export type { ChatRole, InputMode, MeetingStatus };

// Body of every API error response.
export type ApiError = { error: string };

// 202 from POST /api/meetings and POST /api/meetings/[id]/retry.
export type ProcessingStarted = { id: string; status: MeetingStatus };

// GET /api/meetings/[id]/status
export type MeetingStatusResponse = { status: MeetingStatus; errorMessage: string | null };

// One chat message as the API returns it and the chat panel shows it (createdAt as an ISO string).
export type ChatMessageView = {
  id: string;
  role: ChatRole;
  content: string;
  inputMode: InputMode;
  createdAt: string;
};

// GET /api/meetings/[id]/chat: the meeting's chat, oldest first.
export type ChatHistoryResponse = { messages: ChatMessageView[] };

// 201 from POST /api/meetings/[id]/chat
export type ChatReply = { userMessage: ChatMessageView; assistantMessage: ChatMessageView };

// 200 from POST /api/transcribe-question: a spoken question as text.
export type TranscribedQuestion = { text: string };

// Error body of POST /api/meetings/[id]/chat. userMessage is set when the question was saved but
// not answered (502 when Langflow fails), so the panel can show it with a Retry button.
export type ChatErrorResponse = ApiError & { userMessage?: ChatMessageView };
