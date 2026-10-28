// POST /api/meetings/[id]/retry: runs processing again for a FAILED meeting and answers 202.
// processMeeting reuses a saved transcript, so a failed report step does not transcribe again.
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { processMeeting } from "@/lib/process-meeting";
import { isValidMeetingId } from "@/lib/validation";
import type { ApiError, ProcessingStarted } from "@/types";

export async function POST(_request: Request, ctx: RouteContext<"/api/meetings/[id]/retry">) {
  const { id } = await ctx.params;
  if (!isValidMeetingId(id)) {
    return Response.json({ error: "Invalid meeting id." } satisfies ApiError, { status: 400 });
  }

  try {
    // FAILED -> UPLOADED in one atomic step, so of two quick clicks only one starts a run.
    const { count } = await prisma.meeting.updateMany({
      where: { id, status: "FAILED" },
      data: { status: "UPLOADED", errorMessage: null },
    });
    if (count === 0) {
      const meeting = await prisma.meeting.findUnique({ where: { id }, select: { status: true } });
      if (!meeting) {
        return Response.json({ error: "Meeting not found." } satisfies ApiError, { status: 404 });
      }
      return Response.json(
        { error: `Only a failed meeting can be retried; this one is ${meeting.status.toLowerCase()}.` } satisfies ApiError,
        { status: 409 },
      );
    }
  } catch (error) {
    console.error(`[api/meetings/retry] Could not restart meeting ${id}:`, error);
    return Response.json(
      { error: "Could not restart processing. Check that the database is running, then try again." } satisfies ApiError,
      { status: 500 },
    );
  }

  after(() => processMeeting(id));
  return Response.json({ id, status: "UPLOADED" } satisfies ProcessingStarted, { status: 202 });
}
