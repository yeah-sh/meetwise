// PHASE 6 PLACEHOLDER: reserves the chat panel's place on /meetings/[id] (right column on
// desktop, below the report on phones). Replace this component with the real chat panel.
import { MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ChatPanelPlaceholder() {
  return (
    <aside
      aria-label="Chat with this meeting (coming soon)"
      data-slot="chat-panel"
      className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center lg:sticky lg:top-20 lg:min-h-[calc(100vh-7rem)]"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MessagesSquare className="size-5" />
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <p className="font-medium">Chat with this meeting</p>
        <Badge variant="outline">Coming soon</Badge>
      </div>
      <p className="max-w-64 text-sm text-muted-foreground">
        Ask questions by text or voice and hear the answers, taken only from this meeting&apos;s transcript.
      </p>
    </aside>
  );
}
