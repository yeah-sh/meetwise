// One meeting in the /meetings list. The whole card links to the meeting (the title link is
// stretched over it with ::after); the delete button sits above that link so it stays clickable.
import Link from "next/link";
import { Gavel, ListTodo, TriangleAlert, type LucideIcon } from "lucide-react";
import { WaveformMark } from "@/components/brand/waveform";
import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, plural } from "@/lib/format";
import type { MeetingListItem } from "@/lib/meetings";
import { cn } from "@/lib/utils";

export function MeetingCard({ meeting }: { meeting: MeetingListItem }) {
  const { id, title, description, status, errorMessage, createdAt, counts } = meeting;
  return (
    <Card className="relative h-full transition-shadow hover:shadow-md hover:ring-primary/30 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={status} />
          <time dateTime={createdAt.toISOString()}>{formatDateTime(createdAt)}</time>
        </div>
        <CardAction className="relative z-10">
          <DeleteMeetingButton meetingId={id} title={title} />
        </CardAction>
        <CardTitle className="mt-1 line-clamp-2 break-words">
          <Link href={`/meetings/${id}`} className="outline-none after:absolute after:inset-0">
            {title}
          </Link>
        </CardTitle>
        {description && <CardDescription className="line-clamp-2">{description}</CardDescription>}
      </CardHeader>

      <CardContent className="mt-auto">
        {status === "READY" ? (
          <ul className="flex flex-wrap gap-1.5 text-sm" aria-label="Report contents">
            <Count icon={ListTodo} count={counts.tasks} noun="task" tint="bg-cat-task/15 text-cat-task-foreground" />
            <Count icon={Gavel} count={counts.decisions} noun="decision" tint="bg-cat-decision/15 text-cat-decision-foreground" />
            <Count icon={TriangleAlert} count={counts.risks} noun="risk" tint="bg-cat-risk/15 text-cat-risk-foreground" />
          </ul>
        ) : status === "FAILED" ? (
          <p className="line-clamp-2 text-sm text-destructive">{errorMessage ?? "Processing failed."}</p>
        ) : (
          // A still waveform: the status badge's live dot already shows the work going on.
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <WaveformMark width={14} height={14} className="shrink-0" />
            The report will appear when processing finishes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// A count as a pill tinted with its category's colour (cat-* tokens in globals.css); a zero is only
// outlined and muted, so the counts that matter stand out.
function Count({ icon: Icon, count, noun, tint }: { icon: LucideIcon; count: number; noun: string; tint: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-0.5",
        count === 0 ? "text-muted-foreground ring-1 ring-border ring-inset" : `font-medium ${tint}`,
      )}
    >
      <Icon className="size-3.5" />
      {plural(count, noun)}
    </li>
  );
}
