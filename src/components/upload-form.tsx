"use client";

// Upload form with live progress. Sends the recording to POST /api/meetings, then follows the
// meeting with useMeetingJob (polling its status) until it is READY or FAILED.
import Link from "next/link";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { CircleAlert, FileCheck, FileMusic, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { ProcessingProgress, stepForStatus, UPLOADING_STEP } from "@/components/processing-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMeetingJob } from "@/hooks/use-meeting-job";
import { errorText, readJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";
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
            {/* Inside the keyed form, so "Upload another" also empties it. */}
            <RecordingField accept={accept} disabled={locked} />
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

// The recording field: a click-to-choose area that also takes a dragged file. The real file input
// stays in the form, visually hidden but focusable (Tab, Space and the required check work as
// before), and the area is a second <label> for it. A dropped file is put into that input, so the
// form submits and checks it exactly like a chosen one; type and size are checked on submit.
function RecordingField({ accept, disabled }: { accept: string; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null); // shown in the area; the input holds the real one
  const [dragging, setDragging] = useState(false);

  // dragenter and dragover. Cancelling them is what allows a drop here. While the form is locked the
  // drop is refused rather than ignored: ignored, the browser would open the file in place of the page.
  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    if (!carriesFiles(event)) return; // e.g. dragged text
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    if (!disabled) setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    // dragleave also fires when the pointer moves onto the area's own icon and text.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0]; // several files: the first
    const input = inputRef.current;
    if (disabled || !dropped || !input) return;
    // A FileList cannot be built directly; a DataTransfer makes one holding just this file.
    const transfer = new DataTransfer();
    transfer.items.add(dropped);
    input.files = transfer.files;
    setFile(dropped);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id="audio"
        name="audio"
        type="file"
        accept={accept}
        required
        disabled={disabled}
        onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
        className="peer sr-only"
      />
      <label
        htmlFor="audio"
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-6 text-center transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/60 hover:bg-primary/5",
          dragging && "border-solid border-primary bg-primary/10",
        )}
      >
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            file && !dragging ? "bg-status-ready/15 text-status-ready-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {dragging ? <Upload className="size-5" /> : file ? <FileCheck className="size-5" /> : <FileMusic className="size-5" />}
        </span>
        {dragging ? (
          <FieldText title="Drop the recording here" hint="One audio file" />
        ) : file ? (
          <FieldText title={file.name} hint={`${formatSize(file.size)} · click or drop to replace it`} />
        ) : (
          <FieldText title="Choose a recording" hint="Click to browse, or drop a file here" />
        )}
      </label>
    </div>
  );
}

function FieldText({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex max-w-full flex-col gap-0.5">
      <span className="font-medium wrap-anywhere">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </span>
  );
}

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

// e.g. "850 KB", "12.4 MB"
function formatSize(bytes: number): string {
  if (bytes < BYTES_PER_MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
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
