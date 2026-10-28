// One meeting in the /meetings list. The whole card links to the meeting (the title link is
// stretched over it with ::after); the delete button sits above that link so it stays clickable.
import Link from "next/link";
import { Gavel, ListTodo, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, plural } from "@/lib/format";
import type { MeetingListItem } from "@/lib/meetings";

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
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Report contents">
            <Count icon={ListTodo} text={plural(counts.tasks, "task")} />
            <Count icon={Gavel} text={plural(counts.decisions, "decision")} />
            <Count icon={TriangleAlert} text={plural(counts.risks, "risk")} />
          </ul>
        ) : status === "FAILED" ? (
          <p className="line-clamp-2 text-sm text-destructive">{errorMessage ?? "Processing failed."}</p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            The report will appear when processing finishes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Count({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <Icon className="size-3.5" />
      {text}
    </li>
  );
}
