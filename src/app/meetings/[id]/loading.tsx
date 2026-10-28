// Shown instantly while a meeting page loads its data. Mirrors the page's layout.
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
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl lg:h-[calc(100vh-7rem)]" />
      </div>
    </main>
  );
}
