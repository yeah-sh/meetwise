// The meeting routes with Prisma, src/lib/langflow.ts and the audio storage mocked. The upload test
// also runs the background job handed to after(), so src/lib/process-meeting.ts runs for real.
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/meetings/[id]/route";
import { POST as retry } from "@/app/api/meetings/[id]/retry/route";
import { GET as getStatus } from "@/app/api/meetings/[id]/status/route";
import { POST as upload } from "@/app/api/meetings/route";
import { LangflowError } from "@/lib/langflow";

const { after, prisma, langflow, storage } = vi.hoisted(() => ({
  after: vi.fn(),
  prisma: {
    meeting: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    reportItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
  langflow: { transcribeAudio: vi.fn(), generateReport: vi.fn(), clearMeetingMemory: vi.fn() },
  storage: { saveUpload: vi.fn(), deleteUpload: vi.fn(), resolveUploadPath: vi.fn() },
}));

vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/storage", () => storage);
vi.mock("@/lib/langflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/langflow")>()),
  ...langflow,
}));

const MEETING_ID = "cmh0meeting0000000000001";
const AUDIO_PATH = path.join("storage", "uploads", "0d6a3c1e-7f6b-4c55-9a51-3f1f2b9e8c11.mp3");

const REPORT_JSON = JSON.stringify({
  title: "Beta launch sync",
  description: "Planning the beta launch",
  summary: "The beta launches on 20 November.",
  tasks: [{ text: "Own the release checklist", owner: "Lena", dueDate: "2026-11-20" }],
  decisions: [{ text: "Beta launches on 20 November" }],
});

function context(id = MEETING_ID) {
  return { params: Promise.resolve({ id }) };
}

function uploadRequest(fields: { audio?: File; title?: string }, headers?: HeadersInit) {
  const form = new FormData();
  if (fields.audio) form.append("audio", fields.audio);
  if (fields.title !== undefined) form.append("title", fields.title);
  return new Request("http://localhost/api/meetings", { method: "POST", body: form, headers });
}

const recording = () => new File([new Uint8Array(2048)], "standup.mp3", { type: "audio/mpeg" });

// Runs the job the route handed to after(), as Next.js does once the response is sent.
async function runBackgroundJob() {
  expect(after).toHaveBeenCalledTimes(1);
  const job = after.mock.calls[0][0] as () => Promise<void>;
  await job();
}

beforeEach(() => {
  storage.saveUpload.mockResolvedValue(AUDIO_PATH);
  storage.deleteUpload.mockResolvedValue(undefined);
  storage.resolveUploadPath.mockImplementation((audioPath: string) => path.join(process.cwd(), audioPath));
  prisma.meeting.create.mockResolvedValue({ id: MEETING_ID, status: "UPLOADED" });
  prisma.meeting.updateMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/meetings (upload)", () => {
  it("saves the recording, creates the meeting and answers 202", async () => {
    const audio = recording();
    const response = await upload(uploadRequest({ audio, title: "  Weekly   sync " }));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ id: MEETING_ID, status: "UPLOADED" });
    expect(storage.saveUpload).toHaveBeenCalledWith(expect.any(File), "mp3");
    expect(prisma.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: "Weekly sync",
          status: "UPLOADED",
          audioFileName: "standup.mp3",
          audioPath: AUDIO_PATH,
          audioMimeType: "audio/mpeg",
          audioSizeBytes: audio.size,
        },
      }),
    );
    expect(after).toHaveBeenCalledWith(expect.any(Function));
  });

  it("names a meeting without a title after its file", async () => {
    await upload(uploadRequest({ audio: recording() }));
    expect(prisma.meeting.create.mock.calls[0][0].data.title).toBe("standup.mp3");
  });

  it("answers 400 for a file type that is not audio, and saves nothing", async () => {
    const response = await upload(uploadRequest({ audio: new File(["hello"], "notes.txt", { type: "text/plain" }) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/"\.txt" is not a supported audio type/);
    expect(storage.saveUpload).not.toHaveBeenCalled();
    expect(prisma.meeting.create).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("answers 400 when no file was sent", async () => {
    const response = await upload(uploadRequest({ title: "No file" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/No audio file was sent/);
  });

  it("answers 400 for a body that is not a form", async () => {
    const request = new Request("http://localhost/api/meetings", { method: "POST", body: "not a form" });
    expect((await upload(request)).status).toBe(400);
  });

  it("answers 413 for an oversized upload before reading it", async () => {
    const response = await upload(uploadRequest({ audio: recording() }, { "content-length": String(100 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect((await response.json()).error).toMatch(/larger than the 25 MB limit/);
    expect(storage.saveUpload).not.toHaveBeenCalled();
  });

  it("answers 500 and removes the saved file when the database fails", async () => {
    prisma.meeting.create.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const response = await upload(uploadRequest({ audio: recording() }));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/Check that the database is running/);
    expect(storage.deleteUpload).toHaveBeenCalledWith(AUDIO_PATH);
    expect(after).not.toHaveBeenCalled();
  });
});

describe("background processing after an upload", () => {
  beforeEach(() => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID,
      title: "standup.mp3",
      audioFileName: "standup.mp3",
      audioPath: AUDIO_PATH,
      transcript: null,
    });
    langflow.transcribeAudio.mockResolvedValue("Lena: I'll own the release checklist.");
    langflow.generateReport.mockResolvedValue("```json\n" + REPORT_JSON + "\n```");
  });

  it("transcribes, generates the report and saves the meeting as READY", async () => {
    await upload(uploadRequest({ audio: recording() }));
    await runBackgroundJob();

    expect(langflow.transcribeAudio).toHaveBeenCalledWith(path.join(process.cwd(), AUDIO_PATH));
    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: MEETING_ID },
      data: { transcript: "Lena: I'll own the release checklist.", status: "ANALYSING" },
    });
    expect(langflow.generateReport).toHaveBeenCalledWith("Lena: I'll own the release checklist.");
    expect(prisma.reportItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ category: "TASK", owner: "Lena", dueDate: new Date("2026-11-20T00:00:00Z"), position: 0 }),
        expect.objectContaining({ category: "DECISION", text: "Beta launches on 20 November", position: 1 }),
      ],
    });
    // The meeting was named after its file, so it takes the report's title.
    expect(prisma.meeting.update).toHaveBeenLastCalledWith({
      where: { id: MEETING_ID },
      data: expect.objectContaining({ title: "Beta launch sync", status: "READY", errorMessage: null }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("marks the meeting FAILED with Langflow's message when Langflow fails", async () => {
    langflow.transcribeAudio.mockRejectedValue(
      new LangflowError("UNREACHABLE", "Cannot reach Langflow at http://localhost:7860. Check that Langflow Desktop is running."),
    );
    await upload(uploadRequest({ audio: recording() }));
    await runBackgroundJob();

    expect(langflow.generateReport).not.toHaveBeenCalled();
    expect(prisma.meeting.updateMany).toHaveBeenLastCalledWith({
      where: { id: MEETING_ID },
      data: {
        status: "FAILED",
        errorMessage: "Cannot reach Langflow at http://localhost:7860. Check that Langflow Desktop is running.",
      },
    });
  });

  it("marks the meeting FAILED when the report is not valid JSON", async () => {
    langflow.generateReport.mockResolvedValue("Here is a summary of the meeting, in prose.");
    await upload(uploadRequest({ audio: recording() }));
    await runBackgroundJob();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.meeting.updateMany).toHaveBeenLastCalledWith({
      where: { id: MEETING_ID },
      data: { status: "FAILED", errorMessage: expect.stringMatching(/not in the expected format/) },
    });
  });

  it("hides the details of an unexpected error", async () => {
    langflow.transcribeAudio.mockRejectedValue(new Error("EPERM: operation not permitted, open 'C:\\secret\\path'"));
    await upload(uploadRequest({ audio: recording() }));
    await runBackgroundJob();

    const { errorMessage } = prisma.meeting.updateMany.mock.lastCall?.[0].data ?? {};
    expect(errorMessage).toMatch(/^Something went wrong while processing this meeting/);
    expect(errorMessage).not.toContain("secret");
  });
});

describe("GET /api/meetings/[id]/status", () => {
  it("returns the status and error message", async () => {
    prisma.meeting.findUnique.mockResolvedValue({ id: MEETING_ID, status: "TRANSCRIBING", errorMessage: null, updatedAt: new Date() });
    const response = await getStatus(new Request("http://localhost"), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "TRANSCRIBING", errorMessage: null });
  });

  it("turns a meeting abandoned by a server restart into FAILED", async () => {
    const anHourAgo = new Date(Date.now() - 60 * 60_000);
    prisma.meeting.findUnique.mockResolvedValue({ id: MEETING_ID, status: "ANALYSING", errorMessage: null, updatedAt: anHourAgo });
    const body = await (await getStatus(new Request("http://localhost"), context())).json();
    expect(body).toEqual({ status: "FAILED", errorMessage: expect.stringMatching(/Click Retry/) });
  });

  it("answers 404 for an unknown meeting and 400 for an invalid id", async () => {
    prisma.meeting.findUnique.mockResolvedValue(null);
    expect((await getStatus(new Request("http://localhost"), context())).status).toBe(404);
    expect((await getStatus(new Request("http://localhost"), context("bad id"))).status).toBe(400);
  });
});

describe("POST /api/meetings/[id]/retry", () => {
  it("restarts a FAILED meeting and answers 202", async () => {
    const response = await retry(new Request("http://localhost", { method: "POST" }), context());
    expect(response.status).toBe(202);
    expect(prisma.meeting.updateMany).toHaveBeenCalledWith({
      where: { id: MEETING_ID, status: "FAILED" },
      data: { status: "UPLOADED", errorMessage: null },
    });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("answers 409 for a meeting that did not fail", async () => {
    prisma.meeting.updateMany.mockResolvedValue({ count: 0 });
    prisma.meeting.findUnique.mockResolvedValue({ status: "READY" });
    const response = await retry(new Request("http://localhost", { method: "POST" }), context());
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("Only a failed meeting can be retried; this one is ready.");
    expect(after).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/meetings/[id]", () => {
  beforeEach(() => {
    prisma.meeting.findUnique.mockResolvedValue({ audioPath: AUDIO_PATH });
    prisma.meeting.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes the meeting, its recording and Langflow's chat memory", async () => {
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), context());
    expect(response.status).toBe(204);
    expect(prisma.meeting.deleteMany).toHaveBeenCalledWith({ where: { id: MEETING_ID } });
    expect(storage.deleteUpload).toHaveBeenCalledWith(AUDIO_PATH);
    expect(langflow.clearMeetingMemory).toHaveBeenCalledWith(MEETING_ID);
  });

  it("still answers 204 when Langflow is down", async () => {
    langflow.clearMeetingMemory.mockRejectedValue(new LangflowError("UNREACHABLE", "Cannot reach Langflow."));
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context())).status).toBe(204);
  });

  it("answers 404 for an unknown meeting and deletes nothing", async () => {
    prisma.meeting.findUnique.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context())).status).toBe(404);
    expect(storage.deleteUpload).not.toHaveBeenCalled();
    expect(langflow.clearMeetingMemory).not.toHaveBeenCalled();
  });
});
