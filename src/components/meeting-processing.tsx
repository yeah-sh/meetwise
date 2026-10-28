"use client";

// Shown on /meetings/[id] instead of the report while the meeting is not READY: live progress
// (polled with useMeetingJob, as on the upload page), or the failure message with Retry.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";
import { ProcessingProgress, stepForStatus } from "@/components/processing-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMeetingJob, type MeetingJob } from "@/hooks/use-meeting-job";

export function MeetingProcessing(props: MeetingJob) {
  const router = useRouter();
  const { job, pollError, retry, retrying } = useMeetingJob(props);
  const [retryError, setRetryError] = useState<string | null>(null);
  const { status, errorMessage } = job ?? props;

  // When the polled status moves on, re-render the server page: that updates the header's badge
  // and, once READY, replaces this panel with the report. Once the server has caught up, `status`
  // and props.status match again, so this does not loop.
  useEffect(() => {
    if (status !== props.status) router.refresh();
  }, [status, props.status, router]);

  async function handleRetry() {
    setRetryError(null);
    setRetryError(await retry());
  }

  if (status === "FAILED") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Processing failed</AlertTitle>
            <AlertDescription>{errorMessage ?? "Unknown error."}</AlertDescription>
          </Alert>
          {retryError && <p className="text-sm text-destructive">{retryError}</p>}
          <div>
            <Button onClick={handleRetry} disabled={retrying}>
              {retrying ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preparing the report</CardTitle>
        <CardDescription>
          This page updates by itself. You can also leave it: processing continues on the server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProcessingProgress step={stepForStatus(status)} pollError={pollError} />
      </CardContent>
    </Card>
  );
}
