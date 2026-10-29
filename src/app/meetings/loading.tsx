// Shown instantly while /meetings loads its data. The placeholder cards use the real Card, so they
// have the same surface, shadow and spacing as the meeting cards that replace them.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
          <Card key={index}>
            <CardHeader className="gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="mt-1 h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="mt-auto flex gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
