import { describe, expect, it, vi } from "vitest";
import { MAX_QUESTION_LENGTH } from "@/lib/chat-questions";
import {
  AUDIO_ACCEPT,
  checkChatRequestSize,
  checkQuestionAudioRequestSize,
  checkUploadRequestSize,
  getMaxUploadMb,
  isValidMeetingId,
  validateAudioUpload,
  validateChatQuestion,
  validateQuestionAudio,
  validateTitle,
} from "@/lib/validation";

const MB = 1024 * 1024;

// A small file that reports `size` bytes, so size limits can be tested without allocating megabytes.
function audioFile(name: string, type: string, size = 1024): File {
  const file = new File([new Uint8Array(Math.min(size, 1024))], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function requestWithLength(contentLength: number | null): Request {
  const headers = contentLength === null ? undefined : { "content-length": String(contentLength) };
  return new Request("http://localhost/api", { method: "POST", headers, body: "x" });
}

function errorOf(result: { success: boolean; error?: string }): string {
  expect(result.success).toBe(false);
  return result.error ?? "";
}

describe("validateAudioUpload: allowed types", () => {
  it.each([
    ["meeting.mp3", "audio/mpeg"],
    ["meeting.mp4", "video/mp4"],
    ["meeting.m4a", "audio/x-m4a"],
    ["meeting.m4a", "audio/mp4"],
    ["meeting.wav", "audio/wav"],
    ["meeting.webm", "audio/webm;codecs=opus"],
    ["meeting.ogg", "audio/ogg"],
    ["meeting.flac", "audio/flac"],
  ])("accepts %s sent as %s", (name, type) => {
    const result = validateAudioUpload(audioFile(name, type));
    expect(result.success).toBe(true);
  });

  it("returns the extension and the MIME type without parameters", () => {
    const result = validateAudioUpload(audioFile("Team Sync.WEBM", "audio/webm; codecs=opus"));
    expect(result).toMatchObject({ success: true, data: { extension: "webm", mimeType: "audio/webm", fileName: "Team Sync.WEBM" } });
  });

  it("lists every allowed extension for the file picker", () => {
    expect(AUDIO_ACCEPT).toBe(".mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac");
  });
});

describe("validateAudioUpload: rejected files", () => {
  it.each([
    ["a text file", "notes.txt", "text/plain"],
    ["a video type the transcriber does not take", "clip.mov", "video/quicktime"],
    ["an executable named like audio", "meeting.mp3.exe", "application/octet-stream"],
    ["a file without an extension", "meeting", "audio/mpeg"],
  ])("rejects %s", (_label, name, type) => {
    expect(errorOf(validateAudioUpload(audioFile(name, type)))).toMatch(/not a supported audio type/);
  });

  it("rejects a MIME type that does not match the extension", () => {
    expect(errorOf(validateAudioUpload(audioFile("meeting.mp3", "video/mp4")))).toMatch(/does not match a \.mp3/);
  });

  it("rejects a file without a MIME type", () => {
    expect(errorOf(validateAudioUpload(audioFile("meeting.mp3", "")))).toMatch(/\(unknown\)/);
  });

  it("rejects an empty file", () => {
    expect(errorOf(validateAudioUpload(audioFile("meeting.mp3", "audio/mpeg", 0)))).toBe("The audio file is empty.");
  });

  it("rejects a form field that is text, not a file", () => {
    expect(errorOf(validateAudioUpload("meeting.mp3"))).toMatch(/No audio file was sent/);
    expect(errorOf(validateAudioUpload(null))).toMatch(/No audio file was sent/);
  });
});

describe("validateAudioUpload: size", () => {
  it("accepts a file of exactly the default 25 MB", () => {
    expect(validateAudioUpload(audioFile("meeting.mp3", "audio/mpeg", 25 * MB)).success).toBe(true);
  });

  it("rejects a file over 25 MB", () => {
    expect(errorOf(validateAudioUpload(audioFile("meeting.mp3", "audio/mpeg", 25 * MB + 1)))).toMatch(
      /The file is 25\.0 MB, but the limit is 25 MB/,
    );
  });

  it("uses MAX_UPLOAD_MB when it is set", () => {
    vi.stubEnv("MAX_UPLOAD_MB", "2");
    expect(getMaxUploadMb()).toBe(2);
    expect(errorOf(validateAudioUpload(audioFile("meeting.mp3", "audio/mpeg", 3 * MB)))).toMatch(/limit is 2 MB/);
  });

  it.each(["", "abc", "0", "-5"])("falls back to 25 MB when MAX_UPLOAD_MB is %j", (value) => {
    vi.stubEnv("MAX_UPLOAD_MB", value);
    expect(getMaxUploadMb()).toBe(25);
  });

  it("refuses an oversized request before reading its body", () => {
    expect(checkUploadRequestSize(requestWithLength(27 * MB))).toMatch(/larger than the 25 MB limit/);
    expect(checkUploadRequestSize(requestWithLength(10 * MB))).toBeNull();
    expect(checkUploadRequestSize(requestWithLength(null))).toBeNull();
  });
});

describe("validateQuestionAudio (spoken chat questions)", () => {
  it.each([
    ["question.webm", "audio/webm;codecs=opus"],
    ["question.ogg", "audio/ogg;codecs=opus"],
    ["question.mp4", "audio/mp4"],
    ["question.m4a", "audio/mp4"],
    ["question.wav", "audio/wav"],
  ])("accepts what browsers record: %s", (name, type) => {
    expect(validateQuestionAudio(audioFile(name, type)).success).toBe(true);
  });

  it.each([
    ["question.mp3", "audio/mpeg"],
    ["question.flac", "audio/flac"],
    ["question.txt", "text/plain"],
  ])("rejects %s, which the recorder never produces", (name, type) => {
    expect(errorOf(validateQuestionAudio(audioFile(name, type)))).toMatch(/Use one of: webm, ogg, mp4, m4a, wav/);
  });

  it("accepts exactly 5 MB and rejects anything larger", () => {
    expect(validateQuestionAudio(audioFile("question.webm", "audio/webm", 5 * MB)).success).toBe(true);
    expect(errorOf(validateQuestionAudio(audioFile("question.webm", "audio/webm", 5 * MB + 1)))).toBe(
      "The file is 5.0 MB, but the limit is 5 MB. Keep spoken questions short.",
    );
  });

  it("is not affected by MAX_UPLOAD_MB", () => {
    vi.stubEnv("MAX_UPLOAD_MB", "100");
    expect(validateQuestionAudio(audioFile("question.webm", "audio/webm", 6 * MB)).success).toBe(false);
  });

  it("refuses an oversized request before reading its body", () => {
    expect(checkQuestionAudioRequestSize(requestWithLength(7 * MB))).toMatch(/5 MB limit for a spoken question/);
    expect(checkQuestionAudioRequestSize(requestWithLength(MB))).toBeNull();
  });
});

describe("validateChatQuestion", () => {
  it("trims the question and defaults to TEXT", () => {
    expect(validateChatQuestion({ question: "  What was decided?  " })).toEqual({
      success: true,
      data: { question: "What was decided?", inputMode: "TEXT" },
    });
  });

  it("accepts a spoken question", () => {
    expect(validateChatQuestion({ question: "Who owns the checklist?", inputMode: "VOICE" })).toMatchObject({
      success: true,
      data: { inputMode: "VOICE" },
    });
  });

  it.each(["", "   ", "\n\t"])("rejects an empty question (%j)", (question) => {
    expect(errorOf(validateChatQuestion({ question }))).toBe("Type a question first.");
  });

  it.each([[{}], [{ question: 42 }], [{ question: null }]])("rejects a question that is not text: %j", (body) => {
    expect(errorOf(validateChatQuestion(body))).toBe("The question must be text.");
  });

  it.each([[null], ["What was decided?"], [["What was decided?"]]])("rejects a body that is not an object: %j", (body) => {
    expect(errorOf(validateChatQuestion(body))).toMatch(/Send a JSON object/);
  });

  it(`accepts ${MAX_QUESTION_LENGTH} characters and rejects one more`, () => {
    expect(validateChatQuestion({ question: "a".repeat(MAX_QUESTION_LENGTH) }).success).toBe(true);
    expect(errorOf(validateChatQuestion({ question: "a".repeat(MAX_QUESTION_LENGTH + 1) }))).toMatch(
      /at most 1,000 characters; this one has 1,001/,
    );
  });

  it("counts the length after trimming", () => {
    expect(validateChatQuestion({ question: ` ${"a".repeat(MAX_QUESTION_LENGTH)} ` }).success).toBe(true);
  });

  it("rejects an unknown inputMode", () => {
    expect(errorOf(validateChatQuestion({ question: "Hi", inputMode: "SHOUT" }))).toBe('inputMode must be "TEXT" or "VOICE".');
  });

  it("refuses a request body far larger than a question", () => {
    expect(checkChatRequestSize(requestWithLength(20_000))).toMatch(/too large/);
    expect(checkChatRequestSize(requestWithLength(500))).toBeNull();
  });
});

describe("validateTitle", () => {
  it("returns null for a missing or blank title", () => {
    expect(validateTitle(null)).toEqual({ success: true, data: null });
    expect(validateTitle("   ")).toEqual({ success: true, data: null });
  });

  it("collapses whitespace", () => {
    expect(validateTitle("  Weekly \n  sync ")).toEqual({ success: true, data: "Weekly sync" });
  });

  it("rejects more than 200 characters and a file", () => {
    expect(errorOf(validateTitle("a".repeat(201)))).toMatch(/at most 200 characters/);
    expect(errorOf(validateTitle(audioFile("title.mp3", "audio/mpeg")))).toBe("The title must be text.");
  });
});

describe("isValidMeetingId", () => {
  it.each(["cmh1q2w3e0000abcd1234efgh", "seed-sample-meeting", "a"])("accepts %s", (id) => {
    expect(isValidMeetingId(id)).toBe(true);
  });

  it.each(["", "../etc/passwd", "..\\windows", "id with spaces", "id;drop", "a".repeat(65)])("rejects %j", (id) => {
    expect(isValidMeetingId(id)).toBe(false);
  });
});
