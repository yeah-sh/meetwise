// Server-side validation for user input: audio uploads (type, size), meeting ids, chat questions.
// Server-only: it reads MAX_UPLOAD_MB, and the browser's own checks are never trusted on their own.
import "server-only";
import path from "node:path";
import { MAX_QUESTION_LENGTH } from "@/lib/chat-questions";
import type { InputMode } from "@/types";

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

// The formats the Whisper component in Langflow accepts (AUDIO_FILE_TYPES in
// langflow/components/groq_whisper.py), each with the MIME types browsers report for it.
const AUDIO_TYPES: Record<string, readonly string[]> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  mp4: ["audio/mp4", "video/mp4"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  webm: ["audio/webm", "video/webm"],
  ogg: ["audio/ogg", "application/ogg", "video/ogg"],
  flac: ["audio/flac", "audio/x-flac"],
};

const EXTENSIONS = Object.keys(AUDIO_TYPES);

// For the file picker's accept attribute, e.g. ".mp3,.mp4,...".
export const AUDIO_ACCEPT = EXTENSIONS.map((extension) => `.${extension}`).join(",");

const DEFAULT_MAX_UPLOAD_MB = 25;
const BYTES_PER_MB = 1024 * 1024;
// Room for the multipart boundaries and the title on top of the file itself.
const FORM_OVERHEAD_BYTES = BYTES_PER_MB;
const TITLE_MAX_LENGTH = 200;
const FILE_NAME_MAX_LENGTH = 255;

export function getMaxUploadMb(): number {
  const value = Number(process.env.MAX_UPLOAD_MB);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_UPLOAD_MB;
}

// Checked before the body is read, because request.formData() holds the whole body in memory.
// Returns an error message, or null when the size is fine or unknown.
export function checkUploadRequestSize(request: Request): string | null {
  const maxMb = getMaxUploadMb();
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > maxMb * BYTES_PER_MB + FORM_OVERHEAD_BYTES) {
    return `The upload is larger than the ${maxMb} MB limit. Use a shorter or more compressed recording.`;
  }
  return null;
}

export type ValidAudio = { file: File; fileName: string; extension: string; mimeType: string };

// Checks the "audio" form field: a non-empty file with an allowed extension, a MIME type that
// matches that extension, and a size within MAX_UPLOAD_MB.
export function validateAudioUpload(value: FormDataEntryValue | null): ValidationResult<ValidAudio> {
  if (!(value instanceof File)) {
    return { success: false, error: 'No audio file was sent. Choose a recording (form field "audio").' };
  }
  if (value.size === 0) {
    return { success: false, error: "The audio file is empty." };
  }

  const allowed = `Use one of: ${EXTENSIONS.join(", ")}.`;
  const extension = path.extname(value.name).slice(1).toLowerCase();
  const mimeTypes = AUDIO_TYPES[extension];
  if (!mimeTypes) {
    return { success: false, error: `"${extension ? `.${extension}` : "No extension"}" is not a supported audio type. ${allowed}` };
  }
  // A type can carry parameters, e.g. "audio/webm;codecs=opus".
  const mimeType = value.type.split(";")[0].trim().toLowerCase();
  if (!mimeTypes.includes(mimeType)) {
    return {
      success: false,
      error: `The file's type (${mimeType || "unknown"}) does not match a .${extension} audio file. ${allowed}`,
    };
  }

  const maxMb = getMaxUploadMb();
  if (value.size > maxMb * BYTES_PER_MB) {
    const sizeMb = (value.size / BYTES_PER_MB).toFixed(1);
    return {
      success: false,
      error: `The file is ${sizeMb} MB, but the limit is ${maxMb} MB. Use a shorter or more compressed recording.`,
    };
  }

  // The name is only shown to the user; files are saved under generated names (see storage.ts).
  const fileName = value.name.trim().slice(0, FILE_NAME_MAX_LENGTH);
  return { success: true, data: { file: value, fileName, extension, mimeType } };
}

// The optional "title" form field. Returns null when it is missing or blank.
export function validateTitle(value: FormDataEntryValue | null): ValidationResult<string | null> {
  if (value === null) return { success: true, data: null };
  if (typeof value !== "string") return { success: false, error: "The title must be text." };
  const title = value.replace(/\s+/g, " ").trim();
  if (title.length > TITLE_MAX_LENGTH) {
    return { success: false, error: `The title can be at most ${TITLE_MAX_LENGTH} characters.` };
  }
  return { success: true, data: title || null };
}

// Prisma's cuids and fixed ids like the seed's "seed-sample-meeting" use only these characters,
// so anything else is rejected before it reaches the database.
const MEETING_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidMeetingId(id: string): boolean {
  return MEETING_ID_PATTERN.test(id);
}

// A chat request is a short JSON object. A 1,000-character question takes at most ~6 KB even with
// every character escaped, so anything far larger is refused before the body is read.
const CHAT_BODY_MAX_BYTES = 16 * 1024;

// Returns an error message, or null when the size is fine or unknown.
export function checkChatRequestSize(request: Request): string | null {
  const contentLength = Number(request.headers.get("content-length"));
  return contentLength > CHAT_BODY_MAX_BYTES ? "The request is too large for a chat question." : null;
}

export type ValidChatQuestion = { question: string; inputMode: InputMode };

// The JSON body of POST /api/meetings/[id]/chat: { question: string, inputMode?: "TEXT" | "VOICE" }.
// The question is trimmed and must then be 1 to MAX_QUESTION_LENGTH characters.
export function validateChatQuestion(body: unknown): ValidationResult<ValidChatQuestion> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { success: false, error: 'Send a JSON object such as { "question": "What was decided?" }.' };
  }
  const { question, inputMode = "TEXT" } = body as Record<string, unknown>;
  if (typeof question !== "string") {
    return { success: false, error: "The question must be text." };
  }
  const trimmed = question.trim();
  if (!trimmed) {
    return { success: false, error: "Type a question first." };
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return {
      success: false,
      error: `A question can be at most ${MAX_QUESTION_LENGTH.toLocaleString("en-GB")} characters; this one has ${trimmed.length.toLocaleString("en-GB")}.`,
    };
  }
  if (inputMode !== "TEXT" && inputMode !== "VOICE") {
    return { success: false, error: 'inputMode must be "TEXT" or "VOICE".' };
  }
  return { success: true, data: { question: trimmed, inputMode } };
}
