"use client";

// The meeting's recording, played from GET /api/meetings/[id]/audio. Shows a short message
// instead of a broken player when the file cannot be loaded (e.g. the seed meeting has no file).
import { useEffect, useRef, useState } from "react";
import { CircleAlert, FileMusic } from "lucide-react";

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
        <p className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" />
          The recording could not be loaded. The file may be missing from storage/uploads.
        </p>
      ) : (
        <audio ref={audioRef} controls preload="metadata" onError={() => setFailed(true)} className="h-10 w-full">
          Your browser cannot play this recording.
        </audio>
      )}
    </div>
  );
}
