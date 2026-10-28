// A meeting's status as a coloured badge: grey uploaded, blue transcribing, amber analysing,
// green ready, red failed. In-progress statuses show a spinner.
import { CircleAlert, CircleCheck, Clock, LoaderCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isProcessing, STATUS_LABELS } from "@/lib/meeting-status";
import { cn } from "@/lib/utils";
import type { MeetingStatus } from "@/types";

const STATUS_STYLES: Record<MeetingStatus, { icon: LucideIcon; className: string }> = {
  UPLOADED: { icon: Clock, className: "bg-muted text-muted-foreground" },
  TRANSCRIBING: { icon: LoaderCircle, className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  ANALYSING: { icon: LoaderCircle, className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  READY: { icon: CircleCheck, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  FAILED: { icon: CircleAlert, className: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

export function StatusBadge({ status, className }: { status: MeetingStatus; className?: string }) {
  const { icon: Icon, className: colours } = STATUS_STYLES[status];
  return (
    <Badge className={cn(colours, className)}>
      <Icon data-icon="inline-start" className={cn(isProcessing(status) && status !== "UPLOADED" && "animate-spin")} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
