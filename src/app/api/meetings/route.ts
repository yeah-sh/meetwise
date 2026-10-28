// POST /api/meetings: accepts a meeting recording (multipart form: "audio", optional "title"),
// saves it, creates the Meeting and answers 202 with its id. The AI work starts after the
// response has been sent (see src/lib/process-meeting.ts); the client polls the status route.
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { processMeeting } from "@/lib/process-meeting";
import { deleteUpload, saveUpload } from "@/lib/storage";
import { checkUploadRequestSize, validateAudioUpload, validateTitle } from "@/lib/validation";
import type { ApiError, ProcessingStarted } from "@/types";

function badRequest(error: string) {
  return Response.json({ error } satisfies ApiError, { status: 400 });
}

export async function POST(request: Request) {
  const sizeError = checkUploadRequestSize(request);
  if (sizeError) return badRequest(sizeError);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest('Send the upload as multipart/form-data with the recording in the "audio" field.');
  }

  const audio = validateAudioUpload(form.get("audio"));
  if (!audio.success) return badRequest(audio.error);
  const title = validateTitle(form.get("title"));
  if (!title.success) return badRequest(title.error);

  const { file, fileName, extension, mimeType } = audio.data;
  let audioPath: string | undefined;
  try {
    audioPath = await saveUpload(file, extension);
    const meeting = await prisma.meeting.create({
      data: {
        // Without a title the meeting is named after its file until the report supplies one.
        title: title.data ?? fileName,
        status: "UPLOADED",
        audioFileName: fileName,
        audioPath,
        audioMimeType: mimeType,
        audioSizeBytes: file.size,
      },
      select: { id: true, status: true },
    });

    after(() => processMeeting(meeting.id));
    return Response.json(meeting satisfies ProcessingStarted, { status: 202 });
  } catch (error) {
    console.error("[api/meetings] Could not save the upload:", error);
    // Do not keep a file that no meeting points to.
    if (audioPath) await deleteUpload(audioPath).catch(() => {});
    return Response.json(
      { error: "The upload could not be saved. Check that the database is running, then try again." } satisfies ApiError,
      { status: 500 },
    );
  }
}
