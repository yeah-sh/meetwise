// /api/meetings/[id]/chat: the chat about one meeting.
//   GET    -> { messages }, oldest first
//   POST   { question, inputMode? } -> 201 { userMessage, assistantMessage }. The answer comes from the
//          Q&A flow in Langflow, which answers only from this meeting's transcript.
//   DELETE -> 204. Clears the chat in the database and in Langflow's memory.
import { answerQuestion, listChatMessages, saveAnswer, saveQuestion } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { clearMeetingMemory, LangflowError } from "@/lib/langflow";
import { checkChatRequestSize, isValidMeetingId, validateChatQuestion } from "@/lib/validation";
import type { ChatErrorResponse, ChatHistoryResponse, ChatMessageView, ChatReply } from "@/types";

type Context = RouteContext<"/api/meetings/[id]/chat">;

function fail(status: number, error: string, userMessage?: ChatMessageView) {
  return Response.json({ error, userMessage } satisfies ChatErrorResponse, { status });
}

export async function GET(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (!isValidMeetingId(id)) return fail(400, "Invalid meeting id.");

  try {
    const meeting = await prisma.meeting.findUnique({ where: { id }, select: { id: true } });
    if (!meeting) return fail(404, "Meeting not found.");
    const messages = await listChatMessages(id);
    return Response.json({ messages } satisfies ChatHistoryResponse);
  } catch (error) {
    console.error(`[api/meetings/chat] Could not read the chat of meeting ${id}:`, error);
    return fail(500, "Could not load the chat. Check that the database is running, then try again.");
  }
}

export async function POST(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (!isValidMeetingId(id)) return fail(400, "Invalid meeting id.");
  const sizeError = checkChatRequestSize(request);
  if (sizeError) return fail(413, sizeError);
  const parsed = validateChatQuestion(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error);
  const { question, inputMode } = parsed.data;

  // 1. The meeting must be READY, with a transcript to answer from. Then the question is saved.
  let meeting: { id: string; transcript: string; summary: string | null };
  let userMessage: ChatMessageView;
  try {
    const found = await prisma.meeting.findUnique({
      where: { id },
      select: { status: true, transcript: true, summary: true },
    });
    if (!found) return fail(404, "Meeting not found. It may have been deleted.");
    if (found.status === "FAILED") {
      return fail(409, "Processing failed for this meeting. Retry it, then ask your question once the report is ready.");
    }
    if (found.status !== "READY") {
      return fail(409, "This meeting is still being processed. Ask your question once the report is ready.");
    }
    if (!found.transcript?.trim()) return fail(409, "This meeting has no transcript to answer from.");
    meeting = { id, transcript: found.transcript, summary: found.summary };
    userMessage = await saveQuestion(id, question, inputMode);
  } catch (error) {
    console.error(`[api/meetings/chat] Could not save a question for meeting ${id}:`, error);
    return fail(500, "Could not save your question. Check that the database is running, then try again.");
  }

  // 2. Ask Langflow. If that fails, the question stays saved (the panel offers Retry) and no answer is saved.
  let answer: string;
  try {
    answer = await answerQuestion(meeting, userMessage);
  } catch (error) {
    console.error(`[api/meetings/chat] Meeting ${id}: no answer from Langflow:`, error);
    if (error instanceof LangflowError) {
      // LangflowError messages are written for people and never contain the API key.
      return fail(502, `Could not get an answer. ${error.message}`, userMessage);
    }
    return fail(500, "Something went wrong while getting the answer. Check the server log, then press Retry.", userMessage);
  }

  // 3. Save the answer.
  try {
    const assistantMessage = await saveAnswer(id, answer);
    return Response.json({ userMessage, assistantMessage } satisfies ChatReply, { status: 201 });
  } catch (error) {
    console.error(`[api/meetings/chat] Meeting ${id}: could not save the answer:`, error);
    return fail(500, "The answer could not be saved. Check that the database is running, then press Retry.", userMessage);
  }
}

export async function DELETE(_request: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (!isValidMeetingId(id)) return fail(400, "Invalid meeting id.");

  try {
    const meeting = await prisma.meeting.findUnique({ where: { id }, select: { id: true } });
    if (!meeting) return fail(404, "Meeting not found.");
    await prisma.chatMessage.deleteMany({ where: { meetingId: id } });
  } catch (error) {
    console.error(`[api/meetings/chat] Could not clear the chat of meeting ${id}:`, error);
    return fail(500, "Could not clear the chat. Check that the database is running, then try again.");
  }

  // Best effort, after the database (the source of truth) is cleared. If Langflow cannot be reached,
  // its memory keeps the old turns, which then only feed the next answers' follow-up context.
  try {
    await clearMeetingMemory(id);
  } catch (error) {
    console.warn(
      `[api/meetings/chat] Meeting ${id}: chat cleared, but not Langflow's memory of it:`,
      error instanceof Error ? error.message : error,
    );
  }
  return new Response(null, { status: 204 });
}
