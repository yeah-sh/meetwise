// The centred message for an empty list, an error or a missing page, so they all share one width,
// spacing, icon size and type: the empty /meetings list, meetings/error.tsx and
// meetings/[id]/not-found.tsx. It shows either a line drawing from components/brand, or a lucide
// icon in a circle tinted by tone.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  brand: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

type StateMessageProps = (
  | { illustration: ReactNode } // sized by its own width class, e.g. w-40
  | { icon: LucideIcon; tone: keyof typeof TONES }
) & {
  title: string;
  headingLevel?: 1 | 2; // 1 when the message is the whole page, 2 under the page's own h1
  children: ReactNode; // a sentence or two under the title
  action: ReactNode;
};

export function StateMessage(props: StateMessageProps) {
  const { title, headingLevel = 2, children, action } = props;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      {"illustration" in props ? props.illustration : <StateIcon icon={props.icon} tone={props.tone} />}
      <div className="flex flex-col gap-1.5">
        <Heading className="type-title">{title}</Heading>
        <p className="text-sm text-pretty text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  );
}

function StateIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: keyof typeof TONES }) {
  return (
    <span className={cn("flex size-12 items-center justify-center rounded-full", TONES[tone])}>
      <Icon className="size-6" />
    </span>
  );
}
