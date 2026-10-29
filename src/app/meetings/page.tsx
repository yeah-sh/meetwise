// /meetings: every meeting, newest first, as cards with status and report counts.
import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { BlankMinuteBook } from "@/components/brand/minute-book";
import { MeetingCard } from "@/components/meeting-card";
import { RefreshWhileProcessing } from "@/components/refresh-while-processing";
import { StateMessage } from "@/components/state-message";
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

// The dashed frame marks the space where the meeting cards will appear.
function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed">
      <StateMessage
        illustration={<BlankMinuteBook className="w-40 text-muted-foreground" />}
        title="No meetings yet"
        action={
          <Link href="/upload" className={buttonVariants()}>
            <Upload data-icon="inline-start" />
            Upload a meeting
          </Link>
        }
      >
        Upload a recording to get a transcript and a structured report you can search and ask questions about.
      </StateMessage>
    </div>
  );
}
