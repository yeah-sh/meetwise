"use client";

// Shown when /meetings or a meeting page fails to render, almost always because the database is
// not reachable. Server error details stay in the server log; the browser only gets a digest.
import { CircleAlert, RotateCcw } from "lucide-react";
import { StateMessage } from "@/components/state-message";
import { Button } from "@/components/ui/button";

export default function MeetingsError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:py-10">
      <StateMessage
        icon={CircleAlert}
        tone="destructive"
        title="Could not load meetings"
        headingLevel={1}
        action={
          <Button onClick={() => retry()}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Button>
        }
      >
        Check that PostgreSQL is running and that the server log shows no errors, then try again.
      </StateMessage>
    </main>
  );
}
