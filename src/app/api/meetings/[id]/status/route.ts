// GET /api/meetings/[id]/status: { status, errorMessage }, polled by the upload page.
import { prisma } from "@/lib/db";
import { failIfInterrupted } from "@/lib/process-meeting";
import { isValidMeetingId } from "@/lib/validation";
import type { ApiError, MeetingStatusResponse } from "@/types";

export async function GET(_request: Request, ctx: RouteContext<"/api/meetings/[id]/status">) {
  const { id } = await ctx.params;
  if (!isValidMeetingId(id)) {
    return Response.json({ error: "Invalid meeting id." } satisfies ApiError, { status: 400 });
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { id: true, status: true, errorMessage: true, updatedAt: true },
    });
    if (!meeting) {
      return Response.json({ error: "Meeting not found." } satisfies ApiError, { status: 404 });
    }
    const { status, errorMessage } = await failIfInterrupted(meeting);
    return Response.json({ status, errorMessage } satisfies MeetingStatusResponse);
  } catch (error) {
    console.error(`[api/meetings/status] Could not read meeting ${id}:`, error);
    return Response.json(
      { error: "Could not read the meeting's status. Check that the database is running." } satisfies ApiError,
      { status: 500 },
    );
  }
}
