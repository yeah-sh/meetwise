// POST /api/transcribe-question with src/lib/langflow.ts and the temporary audio storage mocked:
// upload checks, what counts as "nothing was said", and Langflow failures.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/transcribe-question/route";
import { LangflowError } from "@/lib/langflow";

const { transcribeAudio, storage } = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  storage: { saveTempAudio: vi.fn(), deleteTempAudio: vi.fn() },
}));

vi.mock("@/lib/storage", () => storage);
vi.mock("@/lib/langflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/langflow")>()),
  transcribeAudio,
}));

const TEMP_PATH = "C:\\meetwise\\storage\\uploads\\tmp\\question.webm";
const NOT_HEARD = "I couldn't hear a question, please try again.";

function sendRecording(file = new File([new Uint8Array(4096)], "question.webm", { type: "audio/webm;codecs=opus" })) {
  const form = new FormData();
  form.append("audio", file);
  return POST(new Request("http://localhost/api/transcribe-question", { method: "POST", body: form }));
}

beforeEach(() => {
  storage.saveTempAudio.mockResolvedValue(TEMP_PATH);
  storage.deleteTempAudio.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/transcribe-question", () => {
  it("returns the transcribed question with its whitespace tidied, and deletes the recording", async () => {
    transcribeAudio.mockResolvedValue("  What was   decided\nabout the launch? ");
    const response = await sendRecording();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "What was decided about the launch?" });
    expect(storage.saveTempAudio).toHaveBeenCalledWith(expect.any(File), "webm");
    expect(transcribeAudio).toHaveBeenCalledWith(TEMP_PATH);
    expect(storage.deleteTempAudio).toHaveBeenCalledWith(TEMP_PATH);
  });

  it.each(["", "   ", "you", "You.", "Thank you.", "thank you!", "Thanks for watching!", "Thank you for watching.", "Bye.", "...", "♪ ♪"])(
    "treats the silent-recording result %j as nothing heard",
    async (transcript) => {
      transcribeAudio.mockResolvedValue(transcript);
      const response = await sendRecording();
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: NOT_HEARD });
    },
  );

  it.each(["Thank you, what was decided?", "Who said bye to the old vendor?", "Did you agree?"])(
    "keeps a real question that contains a silence phrase: %j",
    async (transcript) => {
      transcribeAudio.mockResolvedValue(transcript);
      expect(await (await sendRecording()).json()).toEqual({ text: transcript });
    },
  );

  it("answers 400 when Whisper found no speech, and still deletes the recording", async () => {
    transcribeAudio.mockRejectedValue(new LangflowError("NO_SPEECH", "No speech was found in the recording."));
    const response = await sendRecording();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: NOT_HEARD });
    expect(storage.deleteTempAudio).toHaveBeenCalledWith(TEMP_PATH);
  });

  it("answers 502 with Langflow's message when Langflow fails", async () => {
    transcribeAudio.mockRejectedValue(new LangflowError("RATE_LIMIT", "A rate limit was reached during transcription."));
    const response = await sendRecording();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("Could not transcribe your question. A rate limit was reached during transcription.");
    expect(storage.deleteTempAudio).toHaveBeenCalledWith(TEMP_PATH);
  });

  it("answers 400 for a format the recorder never produces, and saves nothing", async () => {
    const response = await sendRecording(new File([new Uint8Array(10)], "question.mp3", { type: "audio/mpeg" }));
    expect(response.status).toBe(400);
    expect(storage.saveTempAudio).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("answers 400 for a recording over 5 MB", async () => {
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "question.webm", { type: "audio/webm" });
    const response = await sendRecording(large);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/limit is 5 MB/);
  });

  it("answers 413 for an oversized request before reading it", async () => {
    const request = new Request("http://localhost/api/transcribe-question", {
      method: "POST",
      headers: { "content-length": String(20 * 1024 * 1024) },
      body: "x",
    });
    expect((await POST(request)).status).toBe(413);
  });
});
