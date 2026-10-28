// Meeting status helpers shared by server and client components.
import type { MeetingStatus } from "@/types";

export const STATUS_LABELS: Record<MeetingStatus, string> = {
  UPLOADED: "Uploaded",
  TRANSCRIBING: "Transcribing",
  ANALYSING: "Analysing",
  READY: "Ready",
  FAILED: "Failed",
};

// True while the AI pipeline still has work to do for the meeting.
export function isProcessing(status: MeetingStatus): boolean {
  return status === "UPLOADED" || status === "TRANSCRIBING" || status === "ANALYSING";
}
