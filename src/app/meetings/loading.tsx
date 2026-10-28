// Shown instantly while /meetings loads its data.
import { Skeleton } from "@/components/ui/skeleton";

export default function MeetingsLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10" aria-busy="true" aria-label="Loading meetings">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
