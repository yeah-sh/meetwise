// /meetings/[id]: one meeting's header and recording, then its report and transcript in tabs
// (or its processing progress until it is READY), with the chat panel's column beside them.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ScrollText } from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import { MeetingChat } from "@/components/meeting-chat";
import { MeetingProcessing } from "@/components/meeting-processing";
import { MeetingReport } from "@/components/meeting-report";
import { StatusBadge } from "@/components/status-badge";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { suggestQuestions } from "@/lib/chat-questions";
import { formatDateTime } from "@/lib/format";
import { getMeeting, type MeetingDetail } from "@/lib/meetings";

export async function generateMetadata({ params }: PageProps<"/meetings/[id]">): Promise<Metadata> {
  const meeting = await getMeeting((await params).id);
  return { title: `${meeting?.title ?? "Meeting not found"} · MeetWise` };
}

export default async function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  const meeting = await getMeeting((await params).id);
  if (!meeting) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
      <Link
        href="/meetings"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        All meetings
      </Link>

      {/* Two columns on desktop (content | chat), one column with the chat last on phones. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <MeetingHeader meeting={meeting} />
          {meeting.status === "READY" ? (
            <ReportTabs meeting={meeting} />
          ) : (
            <MeetingProcessing meetingId={meeting.id} status={meeting.status} errorMessage={meeting.errorMessage} />
          )}
        </div>

        {/* Usable once the meeting is READY; until then it says when the chat will open.
            key: a different meeting starts with its own chat state. */}
        <MeetingChat
          key={meeting.id}
          meetingId={meeting.id}
          status={meeting.status}
          initialMessages={meeting.chatMessages}
          suggestions={suggestQuestions(meeting.reportItems)}
        />
      </div>
    </main>
  );
}

function MeetingHeader({ meeting }: { meeting: MeetingDetail }) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <StatusBadge status={meeting.status} />
        <time dateTime={meeting.createdAt.toISOString()}>{formatDateTime(meeting.createdAt)}</time>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-balance break-words sm:text-3xl">{meeting.title}</h1>
      {meeting.description && <p className="text-pretty text-muted-foreground">{meeting.description}</p>}
      <AudioPlayer meetingId={meeting.id} fileName={meeting.audioFileName} />
    </header>
  );
}

function ReportTabs({ meeting }: { meeting: MeetingDetail }) {
  return (
    <Tabs defaultValue="report" className="gap-4">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="report" className="sm:px-4">
          <FileText />
          Report
        </TabsTrigger>
        <TabsTrigger value="transcript" className="sm:px-4">
          <ScrollText />
          Transcript
        </TabsTrigger>
      </TabsList>
      <TabsContent value="report">
        <MeetingReport summary={meeting.summary} items={meeting.reportItems} />
      </TabsContent>
      {/* keepMounted: the search box keeps its text when switching tabs. */}
      <TabsContent value="transcript" keepMounted>
        {meeting.transcript ? (
          <TranscriptViewer transcript={meeting.transcript} />
        ) : (
          <p className="text-muted-foreground">This meeting has no transcript.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
