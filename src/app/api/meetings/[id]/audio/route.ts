// GET /api/meetings/[id]/audio: streams the meeting's recording with the content type saved at upload.
// The browser only ever sees this URL, never the storage path. Supports single byte ranges
// (Range: bytes=start-end), which <audio> uses to read the duration and to seek.
import { prisma } from "@/lib/db";
import { getUploadSize, streamUpload } from "@/lib/storage";
import { isValidMeetingId } from "@/lib/validation";
import type { ApiError } from "@/types";

function errorResponse(error: string, status: number) {
  return Response.json({ error } satisfies ApiError, { status });
}

export async function GET(request: Request, ctx: RouteContext<"/api/meetings/[id]/audio">) {
  const { id } = await ctx.params;
  if (!isValidMeetingId(id)) return errorResponse("Invalid meeting id.", 400);

  let meeting: { audioPath: string; audioMimeType: string } | null;
  try {
    meeting = await prisma.meeting.findUnique({ where: { id }, select: { audioPath: true, audioMimeType: true } });
  } catch (error) {
    console.error(`[api/meetings/audio] Could not read meeting ${id}:`, error);
    return errorResponse("Could not read the meeting. Check that the database is running.", 500);
  }
  if (!meeting) return errorResponse("Meeting not found.", 404);

  const size = await getUploadSize(meeting.audioPath);
  if (!size) return errorResponse("The recording file is missing.", 404);

  const headers = new Headers({
    // Saved from the upload's allow-list in validation.ts, so it is always an audio or video type.
    "Content-Type": meeting.audioMimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
  });

  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const { start, end } = range ?? { start: 0, end: size - 1 };
  headers.set("Content-Length", String(end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(streamUpload(meeting.audioPath, start, end), { status: range ? 206 : 200, headers });
}

type ByteRange = { start: number; end: number };

// Parses "bytes=500-999", "bytes=500-" or "bytes=-500" (the last 500 bytes). Returns null to send
// the whole file: no header, or a form this route does not handle, such as several ranges.
function parseRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, first, last] = match;

  if (!first) {
    if (!last) return null;
    const length = Number(last);
    return length > 0 ? { start: Math.max(size - length, 0), end: size - 1 } : "unsatisfiable";
  }

  const start = Number(first);
  if (last && Number(last) < start) return null; // malformed, so the header is ignored
  if (start >= size) return "unsatisfiable";
  return { start, end: last ? Math.min(Number(last), size - 1) : size - 1 };
}
