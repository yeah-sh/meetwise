// /upload: choose a recording, upload it and follow its progress until the report is ready.
import type { Metadata } from "next";
import { UploadForm } from "@/components/upload-form";
import { AUDIO_ACCEPT, getMaxUploadMb } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Upload a meeting · MeetWise",
};

export default function UploadPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      {/* The allowed types and size limit come from the server so the browser can warn before
          uploading. The upload route checks them again on every request. */}
      <UploadForm accept={AUDIO_ACCEPT} maxUploadMb={getMaxUploadMb()} />
    </main>
  );
}
