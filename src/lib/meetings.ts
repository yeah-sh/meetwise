// Database reads for the meeting pages, called from server components.
// Each starts with connection(): with cacheComponents, Next.js would otherwise try to run the
// query while prerendering at build time; this keeps every read at request time, so pages are fresh.
import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { failIfInterrupted } from "@/lib/process-meeting";
import { isValidMeetingId } from "@/lib/validation";
import { ReportCategory } from "@/generated/prisma/client";

// The report categories counted on the meeting cards.
const COUNTED_CATEGORIES = [ReportCategory.TASK, ReportCategory.DECISION, ReportCategory.RISK];

// All meetings, newest first, each with its number of tasks, decisions and risks.
export async function listMeetings() {
  await connection();
  const [meetings, groups] = await Promise.all([
    prisma.meeting.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, status: true, errorMessage: true, createdAt: true, updatedAt: true },
    }),
    prisma.reportItem.groupBy({
      by: ["meetingId", "category"],
      where: { category: { in: COUNTED_CATEGORIES } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(groups.map((group) => [`${group.meetingId}:${group.category}`, group._count._all]));
  const countOf = (meetingId: string, category: ReportCategory) => counts.get(`${meetingId}:${category}`) ?? 0;

  return Promise.all(
    meetings.map(async (meeting) => {
      // A meeting abandoned by a server restart shows as FAILED instead of processing forever.
      const { status, errorMessage } = await failIfInterrupted(meeting);
      return {
        ...meeting,
        status,
        errorMessage,
        counts: {
          tasks: countOf(meeting.id, ReportCategory.TASK),
          decisions: countOf(meeting.id, ReportCategory.DECISION),
          risks: countOf(meeting.id, ReportCategory.RISK),
        },
      };
    }),
  );
}

export type MeetingListItem = Awaited<ReturnType<typeof listMeetings>>[number];

// One meeting with its transcript and report items in report order, or null when the id is
// invalid or unknown. Wrapped in cache() so generateMetadata and the page share one query per request.
// The audio path is not selected: the page plays the file through /api/meetings/[id]/audio.
export const getMeeting = cache(async (id: string) => {
  await connection();
  if (!isValidMeetingId(id)) return null;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      audioFileName: true,
      transcript: true,
      summary: true,
      reportItems: {
        orderBy: { position: "asc" },
        select: { id: true, category: true, text: true, owner: true, dueDate: true, status: true, detail: true },
      },
    },
  });
  if (!meeting) return null;

  const { status, errorMessage } = await failIfInterrupted(meeting);
  return { ...meeting, status, errorMessage };
});

export type MeetingDetail = NonNullable<Awaited<ReturnType<typeof getMeeting>>>;
export type ReportItemView = MeetingDetail["reportItems"][number];
