"use client";

// Trash button that asks for confirmation, then calls DELETE /api/meetings/[id] and refreshes the page.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Trash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { errorText, readJson } from "@/lib/api-client";

type DeleteMeetingButtonProps = {
  meetingId: string;
  title: string;
};

export function DeleteMeetingButton({ meetingId, title }: DeleteMeetingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE" });
      await readJson<null>(response);
      setOpen(false);
      router.refresh(); // re-renders the server list without this meeting
    } catch (deleteFailure) {
      setError(errorText(deleteFailure));
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (deleting) return; // keep the dialog up until the request has finished
    setOpen(next);
    setError(null);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete "${title}"`}
            title="Delete meeting"
          />
        }
      >
        <Trash />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{title}&rdquo; will be permanently deleted with its recording, transcript, report and chat. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Trash data-icon="inline-start" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
