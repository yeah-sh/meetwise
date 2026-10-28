"use client";

// Upload form with live progress. Sends the recording to POST /api/meetings, then follows the
// meeting with useMeetingJob (polling its status) until it is READY or FAILED.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CircleAlert, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { ProcessingProgress, stepForStatus, UPLOADING_STEP } from "@/components/processing-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMeetingJob } from "@/hooks/use-meeting-job";
import { errorText, readJson } from "@/lib/api-client";
import type { ProcessingStarted } from "@/types";

const BYTES_PER_MB = 1024 * 1024;

type UploadFormProps = {
  accept: string; // allowed extensions, e.g. ".mp3,.m4a"
  maxUploadMb: number;
};

export function UploadForm({ accept, maxUploadMb }: UploadFormProps) {
  const { job, track, pollError, retry, retrying } = useMeetingJob(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null); // a failed upload or retry request
  const [formKey, setFormKey] = useState(0); // a new key renders an empty form

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read before the inputs are disabled: FormData skips disabled fields.
    const form = new FormData(event.currentTarget);
    const problem = checkFile(form.get("audio"), accept, maxUploadMb);
    setError(problem);
    if (problem) return;

    setUploading(true);
    try {
      const response = await fetch("/api/meetings", { method: "POST", body: form });
      const started = await readJson<ProcessingStarted>(response);
      track({ meetingId: started.id, status: started.status, errorMessage: null });
    } catch (uploadFailure) {
      setError(errorText(uploadFailure));
    } finally {
      setUploading(false);
    }
  }

  async function handleRetry() {
    setError(null);
    setError(await retry());
  }

  function handleReset() {
    track(null);
    setError(null);
    setFormKey((key) => key + 1);
  }

  const locked = uploading || job !== null;
  const step = uploading ? UPLOADING_STEP : job && job.status !== "FAILED" ? stepForStatus(job.status) : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Upload a meeting</CardTitle>
        <CardDescription>
          Upload a recording ({accept.replaceAll(",", ", ")}, up to {maxUploadMb} MB) to get a transcript and a report.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="audio">Recording</Label>
            <Input id="audio" name="audio" type="file" accept={accept} required disabled={locked} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" name="title" maxLength={200} placeholder="Leave empty to use the AI's title" disabled={locked} />
          </div>
          <Button type="submit" disabled={locked}>
            {uploading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
            Upload
          </Button>
        </form>

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step !== null && <ProcessingProgress step={step} pollError={pollError} />}

        {job?.status === "READY" && (
          <div className="flex flex-wrap gap-2">
            {/* The meeting's report page: /meetings/[id] */}
            <Link href={`/meetings/${job.meetingId}`} className={buttonVariants()}>
              Open the report
            </Link>
            <Button variant="outline" onClick={handleReset}>
              Upload another
            </Button>
          </div>
        )}

        {job?.status === "FAILED" && (
          <div className="flex flex-col gap-3">
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Processing failed</AlertTitle>
              <AlertDescription>{job.errorMessage ?? "Unknown error."}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRetry} disabled={retrying}>
                {retrying ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RotateCcw data-icon="inline-start" />
                )}
                Retry
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Upload another
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// The same rules as the server (src/lib/validation.ts), checked first to skip a pointless upload.
function checkFile(value: FormDataEntryValue | null, accept: string, maxUploadMb: number): string | null {
  if (!(value instanceof File) || value.size === 0) return "Choose a recording to upload.";
  const extension = value.name.slice(value.name.lastIndexOf(".")).toLowerCase();
  if (!accept.split(",").includes(extension)) {
    return `That file type is not supported. Use one of: ${accept.replaceAll(",", ", ")}.`;
  }
  if (value.size > maxUploadMb * BYTES_PER_MB) {
    return `The file is ${(value.size / BYTES_PER_MB).toFixed(1)} MB, but the limit is ${maxUploadMb} MB.`;
  }
  return null;
}
