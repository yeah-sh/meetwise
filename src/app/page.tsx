// /: what MeetWise does, with a button to upload a meeting.
import Link from "next/link";
import { ListChecks, MessagesSquare, Upload, type LucideIcon } from "lucide-react";
import { HeroIllustration } from "@/components/brand/hero-illustration";
import { WaveDivider } from "@/components/brand/wave-divider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Upload,
    title: "Upload a recording",
    text: "Drop in an MP3, M4A, WAV or other audio file of your meeting.",
  },
  {
    icon: ListChecks,
    title: "Get a structured report",
    text: "A summary plus tasks, decisions, questions, deadlines, risks, attendees and more.",
  },
  {
    icon: MessagesSquare,
    title: "Ask about the meeting",
    text: "Chat by text or voice. Answers come only from what was said in that meeting.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* The headline beside the hero drawing (a recording turning into report cards); on phones
          the drawing comes after the buttons. */}
      <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 pt-14 pb-12 sm:pt-20 md:grid-cols-2 md:gap-8 md:pb-16">
        <div className="flex flex-col items-center gap-6 text-center md:items-start md:text-left">
          <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            Your AI meeting assistant
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-4xl lg:text-5xl">
            Turn meeting recordings into clear, actionable reports
          </h1>
          <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
            MeetWise transcribes your meeting, pulls out who agreed to do what and by when, and lets you ask
            questions about it afterwards.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/upload" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
              <Upload data-icon="inline-start" />
              Upload a meeting
            </Link>
            <Link href="/meetings" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
              View your meetings
            </Link>
          </div>
        </div>
        <HeroIllustration className="mx-auto h-auto w-full max-w-lg" />
      </section>

      <WaveDivider className="mx-auto w-full max-w-5xl px-4" />

      <section aria-label="How it works" className="mx-auto w-full max-w-5xl px-4 pt-10 pb-16">
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
              </div>
              <h2 className="font-medium">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
