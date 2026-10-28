// DELETE /api/meetings/[id]: deletes the meeting, its report items and chat messages (removed by
// the database's ON DELETE CASCADE) and its audio file. Answers 204 with no body.
// A meeting that is still processing can be deleted too: the pipeline notices the missing row and stops.
import { prisma } from "@/lib/db";
import { deleteUpload } from "@/lib/storage";
import { isValidMeetingId } from "@/lib/validation";
import type { ApiError } from "@/types";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/meetings/[id]">) {
  const { id } = await ctx.params;
  if (!isValidMeetingId(id)) {
    return Response.json({ error: "Invalid meeting id." } satisfies ApiError, { status: 400 });
  }

  let audioPath: string;
  try {
    const meeting = await prisma.meeting.findUnique({ where: { id }, select: { audioPath: true } });
    // deleteMany rather than delete: a meeting removed in the meantime counts as not found instead of throwing.
    const { count } = meeting ? await prisma.meeting.deleteMany({ where: { id } }) : { count: 0 };
    if (!meeting || count === 0) {
      return Response.json({ error: "Meeting not found. It may already have been deleted." } satisfies ApiError, {
        status: 404,
      });
    }
    audioPath = meeting.audioPath;
  } catch (error) {
    console.error(`[api/meetings/delete] Could not delete meeting ${id}:`, error);
    return Response.json(
      { error: "Could not delete the meeting. Check that the database is running, then try again." } satisfies ApiError,
      { status: 500 },
    );
  }

  // The row goes first, so a file that cannot be removed only leaves an orphaned file (logged here),
  // never a meeting whose recording is missing.
  try {
    await deleteUpload(audioPath);
  } catch (error) {
    console.error(`[api/meetings/delete] Meeting ${id} was deleted, but not its audio file:`, error);
  }
  return new Response(null, { status: 204 });
}
