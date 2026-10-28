// /api/meetings/[id]/chat with Prisma and src/lib/langflow.ts mocked. src/lib/chat.ts runs for real,
// so these tests also cover how a question and its answer are saved.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "@/app/api/meetings/[id]/chat/route";
import { LangflowError } from "@/lib/langflow";

const { prisma, askMeeting, clearMeetingMemory } = vi.hoisted(() => ({
  prisma: {
    meeting: { findUnique: vi.fn() },
    chatMessage: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
  askMeeting: vi.fn(),
  clearMeetingMemory: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/langflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/langflow")>()),
  askMeeting,
  clearMeetingMemory,
}));

const MEETING_ID = "cmh0meeting0000000000001";
const TRANSCRIPT = "Priya: Let's lock the beta launch for November 20th.\nLena: I'll own the release checklist.";
const SUMMARY = "The beta launches on November 20th.";
const ANSWER = "The beta launches on **November 20th**.";

const readyMeeting = { status: "READY", transcript: TRANSCRIPT, summary: SUMMARY };

function context(id = MEETING_ID) {
  return { params: Promise.resolve({ id }) };
}

function ask(body: unknown, id = MEETING_ID) {
  const request = new Request(`http://localhost/api/meetings/${id}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(request, context(id));
}

// What prisma.chatMessage.create returns for the data the app saves.
let savedCount = 0;
function saved({ data }: { data: { role: string; content: string; inputMode?: string } }) {
  savedCount += 1;
  return {
    id: `msg-${savedCount}`,
    role: data.role,
    content: data.content,
    inputMode: data.inputMode ?? "TEXT",
    createdAt: new Date(Date.UTC(2026, 9, 29, 10, 0, savedCount)),
  };
}

beforeEach(() => {
  savedCount = 0;
  prisma.meeting.findUnique.mockResolvedValue(readyMeeting);
  prisma.chatMessage.findFirst.mockResolvedValue(null);
  prisma.chatMessage.create.mockImplementation(async (args) => saved(args));
  askMeeting.mockResolvedValue(ANSWER);
  // The routes log failures; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/meetings/[id]/chat: success", () => {
  it("saves the question, asks Langflow and saves the answer", async () => {
    const response = await ask({ question: "  When is the beta launching?  " });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.userMessage).toMatchObject({ role: "USER", content: "When is the beta launching?", inputMode: "TEXT" });
    expect(body.assistantMessage).toMatchObject({ role: "ASSISTANT", content: ANSWER });
    expect(body.assistantMessage.createdAt).toBe("2026-10-29T10:00:02.000Z");

    expect(askMeeting).toHaveBeenCalledWith({
      meetingId: MEETING_ID,
      question: "When is the beta launching?",
      transcript: TRANSCRIPT,
      summary: SUMMARY,
    });
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(2);
  });

  it("saves a spoken question with inputMode VOICE", async () => {
    const body = await (await ask({ question: "Who owns the checklist?", inputMode: "VOICE" })).json();
    expect(body.userMessage.inputMode).toBe("VOICE");
    expect(prisma.chatMessage.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: { meetingId: MEETING_ID, role: "USER", content: "Who owns the checklist?", inputMode: "VOICE" },
    }));
  });

  it("answers a retried question without saving it twice", async () => {
    const unanswered = saved({ data: { role: "USER", content: "When is the beta launching?" } });
    prisma.chatMessage.findFirst.mockResolvedValueOnce(unanswered); // the newest message

    const body = await (await ask({ question: "When is the beta launching?" })).json();
    expect(body.userMessage.id).toBe(unanswered.id);
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1); // the answer only
  });

  it("asks again with a shorter transcript when the request was too large", async () => {
    const longTranscript = "Lena: the release checklist is on track. ".repeat(1000); // ~42,000 characters
    prisma.meeting.findUnique.mockResolvedValue({ ...readyMeeting, transcript: longTranscript });
    askMeeting.mockRejectedValueOnce(new LangflowError("TOO_LARGE", "The input was too large.", 500));

    expect((await ask({ question: "Is the checklist on track?" })).status).toBe(201);
    expect(askMeeting).toHaveBeenCalledTimes(2);
    expect(askMeeting.mock.calls[0][0].transcript).toBe(longTranscript);
    expect(askMeeting.mock.calls[1][0].transcript.length).toBeLessThanOrEqual(16_000);
  });
});

describe("POST /api/meetings/[id]/chat: Langflow failure", () => {
  it("answers 502 with Langflow's message and keeps the question for Retry", async () => {
    askMeeting.mockRejectedValue(
      new LangflowError("RATE_LIMIT", "A rate limit was reached during answering the question. Wait a minute and try again.", 500),
    );

    const response = await ask({ question: "What was decided?" });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe(
      "Could not get an answer. A rate limit was reached during answering the question. Wait a minute and try again.",
    );
    expect(body.userMessage).toMatchObject({ role: "USER", content: "What was decided?" });
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1); // no answer saved
  });

  it("answers 502 when Langflow cannot be reached", async () => {
    askMeeting.mockRejectedValue(new LangflowError("UNREACHABLE", "Cannot reach Langflow at http://localhost:7860."));
    const body = await (await ask({ question: "What was decided?" })).json();
    expect(body.error).toBe("Could not get an answer. Cannot reach Langflow at http://localhost:7860.");
  });

  it("answers 500 with a generic message for an unexpected error", async () => {
    askMeeting.mockRejectedValue(new Error("socket hang up"));
    const response = await ask({ question: "What was decided?" });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/Something went wrong while getting the answer/);
    expect(body.error).not.toContain("socket hang up");
    expect(body.userMessage).toBeDefined();
  });

  it("answers 500 when the answer cannot be saved", async () => {
    prisma.chatMessage.create.mockImplementationOnce(async (args) => saved(args)).mockRejectedValueOnce(new Error("db down"));
    const response = await ask({ question: "What was decided?" });
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/The answer could not be saved/);
  });
});

describe("POST /api/meetings/[id]/chat: meeting not READY", () => {
  it.each(["UPLOADED", "TRANSCRIBING", "ANALYSING"])("answers 409 while the meeting is %s", async (status) => {
    prisma.meeting.findUnique.mockResolvedValue({ status, transcript: null, summary: null });

    const response = await ask({ question: "What was decided?" });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      "This meeting is still being processed. Ask your question once the report is ready.",
    );
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    expect(askMeeting).not.toHaveBeenCalled();
  });

  it("answers 409 with a Retry hint when processing failed", async () => {
    prisma.meeting.findUnique.mockResolvedValue({ status: "FAILED", transcript: null, summary: null });
    const response = await ask({ question: "What was decided?" });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/^Processing failed for this meeting\. Retry it/);
  });

  it("answers 409 for a READY meeting without a transcript", async () => {
    prisma.meeting.findUnique.mockResolvedValue({ ...readyMeeting, transcript: "   " });
    expect((await ask({ question: "What was decided?" })).status).toBe(409);
    expect(askMeeting).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown meeting", async () => {
    prisma.meeting.findUnique.mockResolvedValue(null);
    expect((await ask({ question: "What was decided?" })).status).toBe(404);
  });

  it("answers 500 when the database cannot be reached", async () => {
    prisma.meeting.findUnique.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const response = await ask({ question: "What was decided?" });
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/Check that the database is running/);
  });
});

describe("POST /api/meetings/[id]/chat: invalid input", () => {
  it.each(["", "   ", "\n"])("answers 400 for an empty question (%j) without touching the database", async (question) => {
    const response = await ask({ question });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Type a question first." });
    expect(prisma.meeting.findUnique).not.toHaveBeenCalled();
    expect(askMeeting).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await ask("question=hello");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Send a JSON object/);
  });

  it("answers 400 for a question over 1,000 characters", async () => {
    expect((await ask({ question: "a".repeat(1001) })).status).toBe(400);
  });

  it("answers 400 for an invalid meeting id", async () => {
    const response = await ask({ question: "What was decided?" }, "../../etc");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid meeting id." });
  });

  it("answers 413 for an oversized body before reading it", async () => {
    const request = new Request(`http://localhost/api/meetings/${MEETING_ID}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "50000" },
      body: JSON.stringify({ question: "What was decided?" }),
    });
    expect((await POST(request, context())).status).toBe(413);
  });
});

describe("GET and DELETE /api/meetings/[id]/chat", () => {
  it("lists the chat, oldest first", async () => {
    prisma.chatMessage.findMany.mockResolvedValue([saved({ data: { role: "USER", content: "Hi" } })]);
    const response = await GET(new Request("http://localhost"), context());
    expect(response.status).toBe(200);
    expect((await response.json()).messages).toEqual([expect.objectContaining({ content: "Hi", createdAt: expect.any(String) })]);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "asc" } }));
  });

  it("clears the chat in the database and in Langflow's memory", async () => {
    const response = await DELETE(new Request("http://localhost"), context());
    expect(response.status).toBe(204);
    expect(prisma.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { meetingId: MEETING_ID } });
    expect(clearMeetingMemory).toHaveBeenCalledWith(MEETING_ID);
  });

  it("still answers 204 when Langflow's memory cannot be cleared", async () => {
    clearMeetingMemory.mockRejectedValue(new LangflowError("UNREACHABLE", "Cannot reach Langflow."));
    expect((await DELETE(new Request("http://localhost"), context())).status).toBe(204);
    expect(prisma.chatMessage.deleteMany).toHaveBeenCalled();
  });

  it("answers 404 for an unknown meeting", async () => {
    prisma.meeting.findUnique.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost"), context())).status).toBe(404);
    expect(prisma.chatMessage.deleteMany).not.toHaveBeenCalled();
  });
});
