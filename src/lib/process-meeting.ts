// The AI pipeline for one meeting: transcribe the audio, generate and validate the report, save it.
// Each stage is written to Meeting.status, which the upload page polls.
//
// Why background processing inside the web server is acceptable here: the upload and retry routes
// return 202 at once and hand processMeeting to Next.js's after(), which runs it once the response
// has been sent (supported by `next dev` and `next start`). For a local, single-user app that is
// enough: one Node process, a few meetings at a time, and nothing that Retry cannot redo, because the
// audio stays on disk and a saved transcript is reused. It is not durable, though: stopping the server
// mid-run abandons the work (failIfInterrupted below turns that into FAILED), and many uploads would all
// run at once inside the web process. In production this would be a job queue (e.g. BullMQ on Redis,
// pg-boss on PostgreSQL, or a cloud queue): the route only enqueues the meeting id, and separate worker
// processes run the jobs with automatic retries, backoff and a concurrency limit.
import "server-only";
import { prisma } from "@/lib/db";
import { generateReport, LangflowError, transcribeAudio } from "@/lib/langflow";
import { parseReport, type MeetingReport } from "@/lib/report-schema";
import { resolveUploadPath } from "@/lib/storage";
import { MeetingStatus, ReportCategory, type Meeting, type Prisma } from "@/generated/prisma/client";

// Thrown with a message meant for the user; other errors get GENERIC_ERROR.
class ProcessingError extends Error {}

const GENERIC_ERROR = "Something went wrong while processing this meeting. Check the server log, then try again.";
const MAX_ERROR_LENGTH = 400;

// Never throws: any failure is logged and saved as status FAILED with a short message.
export async function processMeeting(meetingId: string): Promise<void> {
  try {
    await runPipeline(meetingId);
  } catch (error) {
    console.error(`[process-meeting] Meeting ${meetingId} failed:`, error);
    await markFailed(meetingId, toUserMessage(error));
  }
}

async function runPipeline(meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, audioFileName: true, audioPath: true, transcript: true },
  });
  if (!meeting) {
    console.warn(`[process-meeting] Meeting ${meetingId} no longer exists; nothing to process.`);
    return;
  }

  // Claim the meeting in one atomic step: only an UPLOADED meeting may start, so the pipeline
  // never runs twice for the same meeting at the same time.
  const claimed = await prisma.meeting.updateMany({
    where: { id: meetingId, status: MeetingStatus.UPLOADED },
    data: { status: meeting.transcript ? MeetingStatus.ANALYSING : MeetingStatus.TRANSCRIBING, errorMessage: null },
  });
  if (claimed.count === 0) {
    console.warn(`[process-meeting] Meeting ${meetingId} is not waiting to be processed; skipped.`);
    return;
  }

  // A retry reuses the transcript of an earlier attempt instead of transcribing again.
  let transcript = meeting.transcript;
  if (!transcript) {
    transcript = await transcribeAudio(resolveUploadPath(meeting.audioPath));
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { transcript, status: MeetingStatus.ANALYSING },
    });
  }

  const rawReport = await generateReport(transcript);
  const parsed = parseReport(rawReport);
  if (!parsed.success) {
    console.error(`[process-meeting] Meeting ${meetingId}: ${parsed.error}\nRaw report text:\n${rawReport}`);
    throw new ProcessingError(
      "The AI's report was not in the expected format, so it could not be saved. Retrying usually fixes this.",
    );
  }
  await saveReport(meeting, parsed.data);
}

async function saveReport(
  meeting: Pick<Meeting, "id" | "title" | "audioFileName">,
  report: MeetingReport,
): Promise<void> {
  // One transaction: the meeting becomes READY together with its whole report, or not at all.
  await prisma.$transaction([
    // Clears items left by any earlier run, so the report never contains duplicates.
    prisma.reportItem.deleteMany({ where: { meetingId: meeting.id } }),
    prisma.reportItem.createMany({ data: toReportItems(meeting.id, report) }),
    prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        // A title the user typed is kept. An upload without one was named after its file
        // (see api/meetings/route.ts), and gets the report's title now.
        title: meeting.title === meeting.audioFileName ? report.title : meeting.title,
        description: report.description,
        summary: report.summary,
        status: MeetingStatus.READY,
        errorMessage: null,
      },
    }),
  ]);
}

type ItemFields = Pick<Prisma.ReportItemCreateManyInput, "text" | "owner" | "dueDate" | "status" | "detail">;

// Maps each JSON list to its ReportCategory. `position` runs across the whole report (as in
// prisma/seed.ts), so sorting by it keeps every section in the order the model wrote it.
function toReportItems(meetingId: string, report: MeetingReport): Prisma.ReportItemCreateManyInput[] {
  const sections: [ReportCategory, ItemFields[]][] = [
    [ReportCategory.TASK, report.tasks.map((t) => ({ text: t.text, owner: t.owner, dueDate: toDate(t.dueDate) }))],
    [ReportCategory.DECISION, report.decisions.map((d) => ({ text: d.text }))],
    [ReportCategory.QUESTION, report.questions.map((q) => ({ text: q.text, status: q.status, detail: q.answer }))],
    [ReportCategory.INSIGHT, report.insights.map((i) => ({ text: i.text }))],
    [ReportCategory.DEADLINE, report.deadlines.map((d) => ({ text: d.text, dueDate: toDate(d.dueDate) }))],
    [ReportCategory.ATTENDEE, report.attendees.map((a) => ({ text: a.name, detail: a.role }))],
    [ReportCategory.FOLLOW_UP, report.followUps.map((f) => ({ text: f.text, owner: f.owner }))],
    [ReportCategory.RISK, report.risks.map((r) => ({ text: r.text, detail: r.impact }))],
    [ReportCategory.AGENDA, report.agenda.map((a) => ({ text: a.text }))],
  ];
  return sections
    .flatMap(([category, items]) => items.map((item) => ({ ...item, category })))
    .map((item, position) => ({ ...item, meetingId, position }));
}

// report-schema.ts already turned anything but a real YYYY-MM-DD date into null. Stored as
// midnight UTC so the calendar day does not shift with the server's time zone.
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toUserMessage(error: unknown): string {
  // LangflowError messages are written for people and never contain secrets.
  if (!(error instanceof LangflowError || error instanceof ProcessingError)) return GENERIC_ERROR;
  const message = error.message;
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}…` : message;
}

async function markFailed(meetingId: string, errorMessage: string): Promise<void> {
  try {
    // updateMany, not update: it does not throw if the meeting was deleted in the meantime.
    await prisma.meeting.updateMany({
      where: { id: meetingId },
      data: { status: MeetingStatus.FAILED, errorMessage },
    });
  } catch (error) {
    console.error(`[process-meeting] Could not mark meeting ${meetingId} as FAILED:`, error);
  }
}

// A run updates the meeting at least every ~13 minutes (the longest stretch is the Langflow
// timeouts in langflow.ts for checking the flow, uploading and transcribing). A meeting still
// "in progress" long after that was abandoned, almost always because the server stopped.
// Raise this if you raise those timeouts.
const STALE_AFTER_MS = 20 * 60_000;
const IN_PROGRESS: MeetingStatus[] = [MeetingStatus.UPLOADED, MeetingStatus.TRANSCRIBING, MeetingStatus.ANALYSING];
const INTERRUPTED_MESSAGE = "Processing stopped before it finished, probably because the server restarted. Click Retry.";

// Called by the status route: turns an abandoned meeting into FAILED so that Retry becomes available.
export async function failIfInterrupted(
  meeting: Pick<Meeting, "id" | "status" | "errorMessage" | "updatedAt">,
): Promise<Pick<Meeting, "status" | "errorMessage">> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  if (!IN_PROGRESS.includes(meeting.status) || meeting.updatedAt > cutoff) return meeting;

  const { count } = await prisma.meeting.updateMany({
    where: { id: meeting.id, status: { in: IN_PROGRESS }, updatedAt: { lt: cutoff } },
    data: { status: MeetingStatus.FAILED, errorMessage: INTERRUPTED_MESSAGE },
  });
  if (count === 0) return meeting;
  console.warn(`[process-meeting] Meeting ${meeting.id} was stuck in ${meeting.status}; marked FAILED.`);
  return { status: MeetingStatus.FAILED, errorMessage: INTERRUPTED_MESSAGE };
}
