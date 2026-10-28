// Shown for /meetings/[id] when the id is invalid or the meeting does not exist (e.g. it was deleted).
import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function MeetingNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Meeting not found</h1>
        <p className="text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
      </div>
      <Link href="/meetings" className={buttonVariants()}>
        Back to meetings
      </Link>
    </main>
  );
}
