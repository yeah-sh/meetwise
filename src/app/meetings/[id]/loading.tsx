// Shown instantly while a meeting page loads its data. Mirrors the page's layout.
import { Waveform } from "@/components/brand/waveform";
import { Skeleton } from "@/components/ui/skeleton";

export default function MeetingLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8" aria-busy="true" aria-label="Loading meeting">
      <Skeleton className="mb-4 h-5 w-28" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-full max-w-xl" />
            {/* The recording, at the audio player's height: its file name, then a row of waveforms
                pulsing like the other placeholders (the 3 px gap matches the bars' own spacing). */}
            <div className="flex h-[5.75rem] flex-col justify-center gap-3 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <Skeleton className="h-4 w-40" />
              <div className="flex animate-pulse gap-[3px] text-muted motion-reduce:animate-none">
                {Array.from({ length: 6 }, (_, index) => (
                  <Waveform key={index} width={124.5} height={36} className="shrink-0" />
                ))}
              </div>
            </div>
          </div>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
        {/* The chat panel's own heights (MeetingChat), so nothing jumps when it arrives. */}
        <Skeleton className="h-[min(40rem,85dvh)] min-h-[26rem] rounded-xl lg:h-[calc(100dvh-7rem)]" />
      </div>
    </main>
  );
}
