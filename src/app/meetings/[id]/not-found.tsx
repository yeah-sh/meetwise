// Shown for /meetings/[id] when the id is invalid or the meeting does not exist (e.g. it was deleted).
import Link from "next/link";
import { TornMinuteBook } from "@/components/brand/minute-book";
import { StateMessage } from "@/components/state-message";
import { buttonVariants } from "@/components/ui/button";

export default function MeetingNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:py-10">
      <StateMessage
        illustration={<TornMinuteBook className="w-40 text-muted-foreground" />}
        title="Meeting not found"
        headingLevel={1}
        action={
          <Link href="/meetings" className={buttonVariants()}>
            Back to meetings
          </Link>
        }
      >
        It may have been deleted, or the link is wrong.
      </StateMessage>
    </main>
  );
}
