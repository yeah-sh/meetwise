// A meeting's status as a tinted badge using the status tokens in globals.css: slate uploaded,
// blue while transcribing or analysing, green ready, red failed. While the meeting is still being
// processed (isProcessing) a small amber "live" dot breathes in place of an icon.
import { CircleAlert, CircleCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isProcessing, STATUS_LABELS } from "@/lib/meeting-status";
import { cn } from "@/lib/utils";
import type { MeetingStatus } from "@/types";

const STATUS_STYLES: Record<MeetingStatus, { icon?: LucideIcon; className: string }> = {
  UPLOADED: { className: "bg-status-uploaded/15 text-status-uploaded-foreground" },
  TRANSCRIBING: { className: "bg-status-processing/15 text-status-processing-foreground" },
  ANALYSING: { className: "bg-status-processing/15 text-status-processing-foreground" },
  READY: { icon: CircleCheck, className: "bg-status-ready/15 text-status-ready-foreground" },
  FAILED: { icon: CircleAlert, className: "bg-status-failed/15 text-status-failed-foreground" },
};

export function StatusBadge({ status, className }: { status: MeetingStatus; className?: string }) {
  const { icon: Icon, className: colours } = STATUS_STYLES[status];
  return (
    <Badge className={cn(colours, className)}>
      {isProcessing(status) ? <LiveDot /> : Icon && <Icon data-icon="inline-start" />}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

// Sits in the icon's 12 px slot. Still when the user prefers reduced motion.
function LiveDot() {
  return (
    <span aria-hidden data-icon="inline-start" className="flex size-3 items-center justify-center">
      <span className="size-2 rounded-full bg-signal motion-safe:animate-live-breathe" />
    </span>
  );
}
