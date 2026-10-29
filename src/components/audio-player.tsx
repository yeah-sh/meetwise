"use client";

// The meeting's recording, played from GET /api/meetings/[id]/audio. Shows a short message
// instead of a broken player when the file cannot be loaded (e.g. the seed meeting has no file).
import { useEffect, useRef, useState } from "react";
import { CircleAlert, FileMusic, Play } from "lucide-react";

type AudioPlayerProps = {
  meetingId: string;
  fileName: string;
};

export function AudioPlayer({ meetingId, fileName }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);

  // The source is set after hydration rather than in the HTML: a load error that happened
  // before React attached onError would otherwise go unnoticed.
  useEffect(() => {
    if (audioRef.current) audioRef.current.src = `/api/meetings/${encodeURIComponent(meetingId)}/audio`;
  }, [meetingId]);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <FileMusic className="size-4 shrink-0" />
        <span className="truncate" title={fileName}>
          {fileName}
        </span>
      </p>
      {failed ? (
        // An empty player where the controls would be: a greyed-out play button with the reason beside it.
        <div className="flex min-h-10 items-center gap-3 rounded-lg bg-muted/60 px-2 py-1.5">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground">
            <Play className="size-3.5 translate-x-px fill-current" />
          </span>
          <p className="flex min-w-0 flex-1 flex-col text-sm">
            <span className="flex items-center gap-1.5 font-medium text-destructive">
              <CircleAlert className="size-3.5 shrink-0" />
              The recording could not be loaded.
            </span>
            <span className="text-xs text-pretty text-muted-foreground">The file may be missing from storage/uploads.</span>
          </p>
        </div>
      ) : (
        <audio ref={audioRef} controls preload="metadata" onError={() => setFailed(true)} className="h-10 w-full">
          Your browser cannot play this recording.
        </audio>
      )}
    </div>
  );
}
