// POST /api/transcribe-question: turns a spoken chat question into text.
//   multipart form, field "audio": a short recording from the chat's mic button (webm, ogg, mp4/m4a
//   or wav, at most MAX_VOICE_MB) -> 200 { text }. 400 when the upload is invalid or no question
//   could be heard. The recording is transcribed by the same Langflow flow as meetings
//   (transcribeAudio), and kept in storage/uploads/tmp/ only while that runs.
import { LangflowError, transcribeAudio } from "@/lib/langflow";
import { deleteTempAudio, saveTempAudio } from "@/lib/storage";
import { checkQuestionAudioRequestSize, validateQuestionAudio } from "@/lib/validation";
import type { ApiError, TranscribedQuestion } from "@/types";

const NOT_HEARD = "I couldn't hear a question, please try again.";

// What Whisper often "hears" in a silent recording. Only exact matches count as silence.
const SILENCE_PHRASES = new Set(["you", "thank you", "thanks for watching", "thank you for watching", "bye"]);

function fail(status: number, error: string) {
  return Response.json({ error } satisfies ApiError, { status });
}

export async function POST(request: Request) {
  const sizeError = checkQuestionAudioRequestSize(request);
  if (sizeError) return fail(413, sizeError);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'Send the recording as multipart/form-data in the "audio" field.');
  }
  const audio = validateQuestionAudio(form.get("audio"));
  if (!audio.success) return fail(400, audio.error);

  let tempPath: string | undefined;
  let transcript: string;
  try {
    tempPath = await saveTempAudio(audio.data.file, audio.data.extension);
    transcript = await transcribeAudio(tempPath);
  } catch (error) {
    if (error instanceof LangflowError && error.code === "NO_SPEECH") return fail(400, NOT_HEARD);
    console.error("[api/transcribe-question] Could not transcribe a question:", error);
    if (error instanceof LangflowError) {
      // LangflowError messages are written for people and never contain the API key.
      return fail(502, `Could not transcribe your question. ${error.message}`);
    }
    return fail(500, "Something went wrong while transcribing your question. Check the server log, then try again.");
  } finally {
    if (tempPath) {
      await deleteTempAudio(tempPath).catch((error) =>
        console.warn("[api/transcribe-question] Could not delete a temporary recording:", error),
      );
    }
  }

  const text = transcript.replace(/\s+/g, " ").trim();
  if (isSilence(text)) return fail(400, NOT_HEARD);
  return Response.json({ text } satisfies TranscribedQuestion);
}

// True for an empty result, one with no letters or digits ("...", "♪"), or a known silence phrase.
function isSilence(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return !words || SILENCE_PHRASES.has(words);
}
