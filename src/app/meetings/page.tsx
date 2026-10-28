// /meetings: every meeting, newest first, as cards with status and report counts.
import type { Metadata } from "next";
import Link from "next/link";
import { FileMusic, Upload } from "lucide-react";
import { MeetingCard } from "@/components/meeting-card";
import { RefreshWhileProcessing } from "@/components/refresh-while-processing";
import { buttonVariants } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { isProcessing } from "@/lib/meeting-status";
import { listMeetings } from "@/lib/meetings";

export const metadata: Metadata = {
  title: "Meetings · MeetWise",
};

export default async function MeetingsPage() {
  const meetings = await listMeetings();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          {meetings.length > 0 && (
            <p className="text-sm text-muted-foreground">{plural(meetings.length, "meeting")}, newest first</p>
          )}
        </div>
        {meetings.length > 0 && (
          <Link href="/upload" className={buttonVariants()}>
            <Upload data-icon="inline-start" />
            Upload
          </Link>
        )}
      </div>

      {meetings.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <MeetingCard meeting={meeting} />
            </li>
          ))}
        </ul>
      )}

      <RefreshWhileProcessing active={meetings.some((meeting) => isProcessing(meeting.status))} />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileMusic className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">No meetings yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload a recording to get a transcript and a structured report you can search and ask questions about.
        </p>
      </div>
      <Link href="/upload" className={buttonVariants()}>
        <Upload data-icon="inline-start" />
        Upload a meeting
      </Link>
    </div>
  );
}
