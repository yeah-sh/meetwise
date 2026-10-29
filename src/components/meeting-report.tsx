// The Report tab of /meetings/[id]: the summary first, then one card per report category in a
// fixed order. Categories without items are left out. Each category has its own colour (the cat-*
// tokens in globals.css) on its icon stamp, left rule, count and jump link. Tasks and Decisions are
// drawn strongest, Agenda and Attendees quietest. A section jumped to from its link flashes briefly.
import type { ReactNode } from "react";
import {
  CalendarClock,
  CalendarDays,
  CircleQuestionMark,
  Forward,
  Gavel,
  Lightbulb,
  ListOrdered,
  ListTodo,
  Sparkles,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDay } from "@/lib/format";
import type { ReportItemView } from "@/lib/meetings";
import { cn } from "@/lib/utils";
import type { ReportCategory } from "@/generated/prisma/enums";

type Weight = "strong" | "normal" | "quiet";

type SectionConfig = { category: ReportCategory; title: string; anchor: string; icon: LucideIcon; weight: Weight };

const SECTIONS: SectionConfig[] = [
  { category: "TASK", title: "Tasks", anchor: "tasks", icon: ListTodo, weight: "strong" },
  { category: "DECISION", title: "Decisions", anchor: "decisions", icon: Gavel, weight: "strong" },
  { category: "QUESTION", title: "Questions", anchor: "questions", icon: CircleQuestionMark, weight: "normal" },
  { category: "INSIGHT", title: "Insights", anchor: "insights", icon: Lightbulb, weight: "normal" },
  { category: "DEADLINE", title: "Deadlines", anchor: "deadlines", icon: CalendarClock, weight: "normal" },
  { category: "ATTENDEE", title: "Attendees", anchor: "attendees", icon: Users, weight: "quiet" },
  { category: "FOLLOW_UP", title: "Follow-ups", anchor: "follow-ups", icon: Forward, weight: "normal" },
  { category: "RISK", title: "Risks", anchor: "risks", icon: TriangleAlert, weight: "normal" },
  { category: "AGENDA", title: "Agenda", anchor: "agenda", icon: ListOrdered, weight: "quiet" },
];

// Written out in full so Tailwind can find the class names. tint: icon stamp and count (text on a
// /15 tint); stamp: the stamp's double rule and its tilt, varied so the stamps look pressed by hand;
// text: an icon straight on the card; rule: the card's left edge; hover: the jump link.
const CATEGORY_STYLES: Record<ReportCategory, { tint: string; stamp: string; text: string; rule: string; hover: string }> = {
  TASK: {
    tint: "bg-cat-task/15 text-cat-task-foreground",
    stamp: "border-cat-task/55 -rotate-3",
    text: "text-cat-task-foreground",
    rule: "before:bg-cat-task",
    hover: "hover:bg-cat-task/10",
  },
  DECISION: {
    tint: "bg-cat-decision/15 text-cat-decision-foreground",
    stamp: "border-cat-decision/55 rotate-2",
    text: "text-cat-decision-foreground",
    rule: "before:bg-cat-decision",
    hover: "hover:bg-cat-decision/10",
  },
  QUESTION: {
    tint: "bg-cat-question/15 text-cat-question-foreground",
    stamp: "border-cat-question/55 -rotate-2",
    text: "text-cat-question-foreground",
    rule: "before:bg-cat-question",
    hover: "hover:bg-cat-question/10",
  },
  INSIGHT: {
    tint: "bg-cat-insight/15 text-cat-insight-foreground",
    stamp: "border-cat-insight/55 rotate-3",
    text: "text-cat-insight-foreground",
    rule: "before:bg-cat-insight",
    hover: "hover:bg-cat-insight/10",
  },
  DEADLINE: {
    tint: "bg-cat-deadline/15 text-cat-deadline-foreground",
    stamp: "border-cat-deadline/55 -rotate-1",
    text: "text-cat-deadline-foreground",
    rule: "before:bg-cat-deadline",
    hover: "hover:bg-cat-deadline/10",
  },
  ATTENDEE: {
    tint: "bg-cat-attendee/15 text-cat-attendee-foreground",
    stamp: "border-cat-attendee/55 rotate-1",
    text: "text-cat-attendee-foreground",
    rule: "before:bg-cat-attendee",
    hover: "hover:bg-cat-attendee/10",
  },
  FOLLOW_UP: {
    tint: "bg-cat-follow-up/15 text-cat-follow-up-foreground",
    stamp: "border-cat-follow-up/55 -rotate-2",
    text: "text-cat-follow-up-foreground",
    rule: "before:bg-cat-follow-up",
    hover: "hover:bg-cat-follow-up/10",
  },
  RISK: {
    tint: "bg-cat-risk/15 text-cat-risk-foreground",
    stamp: "border-cat-risk/55 rotate-2",
    text: "text-cat-risk-foreground",
    rule: "before:bg-cat-risk",
    hover: "hover:bg-cat-risk/10",
  },
  AGENDA: {
    tint: "bg-cat-agenda/15 text-cat-agenda-foreground",
    stamp: "border-cat-agenda/55 -rotate-1",
    text: "text-cat-agenda-foreground",
    rule: "before:bg-cat-agenda",
    hover: "hover:bg-cat-agenda/10",
  },
};

// How loud a section card is: the width of its rule, its elevation, the size of its icon chip and
// title, and (strong only) a larger item text. Quiet cards lie flat: shadow-none needs the ! because
// cn() does not merge it with the Card's own shadow-card. A title size drops CardTitle's leading-snug
// in cn(), so it is repeated.
const WEIGHT_STYLES: Record<Weight, { card: string; chip: string; title: string; content: string }> = {
  strong: { card: "before:w-1", chip: "size-8 [&_svg]:size-[1.125rem]", title: "text-lg leading-snug", content: "type-body" },
  normal: { card: "before:w-[3px]", chip: "", title: "", content: "" },
  quiet: {
    card: "bg-card/50 shadow-none! before:w-0.5",
    chip: "size-6 [&_svg]:size-3.5",
    title: "text-[0.9375rem] leading-snug",
    content: "",
  },
};

type MeetingReportProps = {
  summary: string | null;
  items: ReportItemView[]; // already in report order (by position)
};

export function MeetingReport({ summary, items }: MeetingReportProps) {
  const sections = SECTIONS.map((section) => ({
    ...section,
    items: items.filter((item) => item.category === section.category),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <SectionTitle icon={Sparkles} chipClassName="border-primary/45 bg-primary/10 text-primary -rotate-2">
            Summary
          </SectionTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="leading-relaxed text-pretty whitespace-pre-line sm:text-base">
            {summary ?? "No summary was generated for this meeting."}
          </p>
          {sections.length > 0 && (
            <nav aria-label="Report sections" className="flex flex-wrap gap-2">
              {sections.map(({ category, anchor, title, icon: Icon, items: sectionItems }) => {
                const tone = CATEGORY_STYLES[category];
                return (
                  <a
                    key={anchor}
                    href={`#report-${anchor}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      tone.hover,
                    )}
                  >
                    <Icon className={cn("size-3.5", tone.text)} />
                    {title}
                    <span className={cn("rounded-full px-1.5 tabular-nums", tone.tint)}>{sectionItems.length}</span>
                  </a>
                );
              })}
            </nav>
          )}
        </CardContent>
      </Card>

      {sections.map(({ category, title, anchor, icon, weight, items: sectionItems }) => {
        const tone = CATEGORY_STYLES[category];
        const look = WEIGHT_STYLES[weight];
        return (
          // scroll-mt keeps the section clear of the sticky top bar when jumped to, and :target (the
          // section in the URL's #hash) flashes it. ::before is the coloured rule down the left edge;
          // the Card's overflow-hidden rounds it with the corners.
          <Card
            key={category}
            id={`report-${anchor}`}
            className={cn(
              "relative scroll-mt-20 before:absolute before:inset-y-0 before:left-0 motion-safe:target:animate-section-flash",
              tone.rule,
              look.card,
            )}
          >
            <CardHeader>
              <SectionTitle
                icon={icon}
                chipClassName={cn(tone.tint, tone.stamp, look.chip)}
                className={look.title}
                count={sectionItems.length}
                countClassName={tone.tint}
              >
                {title}
              </SectionTitle>
            </CardHeader>
            <CardContent className={look.content}>{renderItems(category, sectionItems)}</CardContent>
          </Card>
        );
      })}
    </div>
  );
}

type SectionTitleProps = {
  icon: LucideIcon;
  chipClassName: string;
  className?: string;
  count?: number;
  countClassName?: string;
  children: ReactNode;
};

// The icon sits in a stamp: a tinted square with a double rule (the 3 px double border), tilted by
// chipClassName.
function SectionTitle({ icon: Icon, chipClassName, className, count, countClassName, children }: SectionTitleProps) {
  return (
    <CardTitle className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border-[3px] border-double [&_svg]:size-4",
          chipClassName,
        )}
      >
        <Icon />
      </span>
      <h2>{children}</h2>
      {count !== undefined && (
        // font-sans: CardTitle is serif, but the count stays in the body font.
        <Badge className={cn("font-sans tabular-nums", countClassName)}>{count}</Badge>
      )}
    </CardTitle>
  );
}

function renderItems(category: ReportCategory, items: ReportItemView[]): ReactNode {
  switch (category) {
    case "ATTENDEE":
      return <AttendeeList items={items} />;
    case "AGENDA":
      return <AgendaList items={items} />;
    case "DEADLINE":
      return <DeadlineList items={items} />;
    case "RISK":
      return <RiskList items={items} />;
    default:
      return (
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
              <p className="text-pretty break-words">{item.text}</p>
              <ItemExtras category={category} item={item} />
            </li>
          ))}
        </ul>
      );
  }
}

// The owner, date, status or answer shown under an item, depending on its category.
function ItemExtras({ category, item }: { category: ReportCategory; item: ReportItemView }) {
  switch (category) {
    case "TASK":
      return (
        <MetaRow>
          <Meta icon={User}>{item.owner ?? "Unassigned"}</Meta>
          {item.dueDate && <Meta icon={CalendarDays}>Due {formatDay(item.dueDate)}</Meta>}
        </MetaRow>
      );
    case "FOLLOW_UP":
      return item.owner ? (
        <MetaRow>
          <Meta icon={User}>{item.owner}</Meta>
        </MetaRow>
      ) : null;
    case "QUESTION": {
      const answered = item.status?.toLowerCase() === "answered";
      return (
        <>
          <div>
            <Badge
              className={
                answered ? "bg-status-ready/15 text-status-ready-foreground" : "bg-signal/15 text-signal-foreground"
              }
            >
              {answered ? "Answered" : "Unanswered"}
            </Badge>
          </div>
          {item.detail && <Detail label="Answer">{item.detail}</Detail>}
        </>
      );
    }
    default:
      return null;
  }
}

function MetaRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{children}</div>;
}

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2 text-pretty break-words text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {children}
    </p>
  );
}

// Report dates are calendar days saved as midnight UTC (see lib/format.ts), so the tile reads them in UTC.
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

function DeadlineList({ items }: { items: ReportItemView[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <DateTile date={item.dueDate} />
          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <p className="text-pretty break-words">{item.text}</p>
            {!item.dueDate && <p className="text-xs text-muted-foreground">No exact date given</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// A small desk-calendar page: month above day, year below. Screen readers get the full date instead.
function DateTile({ date }: { date: Date | null }) {
  if (!date) {
    return (
      <span
        aria-hidden
        className="flex h-[3.75rem] w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-cat-deadline/50 text-cat-deadline-foreground"
      >
        <CalendarClock className="size-5" />
      </span>
    );
  }
  return (
    <time
      dateTime={date.toISOString().slice(0, 10)}
      className="flex h-[3.75rem] w-12 shrink-0 flex-col overflow-hidden rounded-lg bg-card text-center ring-1 ring-cat-deadline/40"
    >
      <span aria-hidden className="bg-cat-deadline/15 py-0.5 text-[0.6875rem] leading-tight font-semibold tracking-wider text-cat-deadline-foreground uppercase">
        {monthFormat.format(date)}
      </span>
      <span aria-hidden className="flex flex-1 items-center justify-center text-lg leading-none font-semibold tabular-nums">
        {date.getUTCDate()}
      </span>
      <span aria-hidden className="pb-1 text-[0.6875rem] leading-none text-muted-foreground tabular-nums">
        {date.getUTCFullYear()}
      </span>
      <span className="sr-only">{formatDay(date)}</span>
    </time>
  );
}

// Each risk as a callout tinted with the risk colour, with its impact inside it.
function RiskList({ items }: { items: ReportItemView[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 rounded-lg border border-cat-risk/25 bg-cat-risk/10 px-3 py-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-cat-risk-foreground" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-pretty break-words">{item.text}</p>
            {item.detail && (
              <p className="border-t border-cat-risk/20 pt-1.5 text-pretty break-words">
                <span className="font-medium text-cat-risk-foreground">Impact:</span> {item.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AttendeeList({ items }: { items: ReportItemView[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cat-attendee/15 text-xs font-semibold text-cat-attendee-foreground"
          >
            {initials(item.text)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{item.text}</p>
            <p className="truncate text-xs text-muted-foreground">{item.detail ?? "Role not mentioned"}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AgendaList({ items }: { items: ReportItemView[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cat-agenda/15 text-xs font-medium text-cat-agenda-foreground tabular-nums">
            {index + 1}
          </span>
          <p className="pt-0.5 text-pretty break-words">{item.text}</p>
        </li>
      ))}
    </ol>
  );
}

// "Priya Sharma" -> "PS", "lena" -> "L"
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
