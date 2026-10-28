"use client";

// Shown when /meetings or a meeting page fails to render, almost always because the database is
// not reachable. Server error details stay in the server log; the browser only gets a digest.
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MeetingsError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Could not load meetings</h1>
        <p className="text-sm text-muted-foreground">
          Check that PostgreSQL is running and that the server log shows no errors, then try again.
        </p>
      </div>
      <Button onClick={() => retry()}>
        <RotateCcw data-icon="inline-start" />
        Try again
      </Button>
    </main>
  );
}
