"use client";

// "Clear" button in the chat panel's header: asks for confirmation, then deletes the meeting's chat
// through onClear (DELETE /api/meetings/[id]/chat).
import { useState } from "react";
import { Eraser, LoaderCircle } from "lucide-react";
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

type ClearChatButtonProps = {
  onClear: () => Promise<string | null>; // resolves to an error message, or null once cleared
  disabled: boolean;
};

export function ClearChatButton({ onClear, disabled }: ClearChatButtonProps) {
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClear() {
    setClearing(true);
    setError(null);
    const failure = await onClear();
    setClearing(false);
    if (failure) setError(failure);
    else setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (clearing) return; // keep the dialog up until the request has finished
    setOpen(next);
    setError(null);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" />}
      >
        <Eraser data-icon="inline-start" />
        Clear
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Eraser />
          </AlertDialogMedia>
          <AlertDialogTitle>Clear this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            All questions and answers about this meeting will be deleted. The recording, transcript and report are kept.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleClear} disabled={clearing}>
            {clearing ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Eraser data-icon="inline-start" />}
            Clear chat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
