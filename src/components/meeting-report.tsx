// The Report tab of /meetings/[id]: the summary first, then one card per report category in a
// fixed order. Categories without items are left out.
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
import type { ReportCategory } from "@/generated/prisma/enums";

type SectionConfig = { category: ReportCategory; title: string; anchor: string; icon: LucideIcon };

const SECTIONS: SectionConfig[] = [
  { category: "TASK", title: "Tasks", anchor: "tasks", icon: ListTodo },
  { category: "DECISION", title: "Decisions", anchor: "decisions", icon: Gavel },
  { category: "QUESTION", title: "Questions", anchor: "questions", icon: CircleQuestionMark },
  { category: "INSIGHT", title: "Insights", anchor: "insights", icon: Lightbulb },
  { category: "DEADLINE", title: "Deadlines", anchor: "deadlines", icon: CalendarClock },
  { category: "ATTENDEE", title: "Attendees", anchor: "attendees", icon: Users },
  { category: "FOLLOW_UP", title: "Follow-ups", anchor: "follow-ups", icon: Forward },
  { category: "RISK", title: "Risks", anchor: "risks", icon: TriangleAlert },
  { category: "AGENDA", title: "Agenda", anchor: "agenda", icon: ListOrdered },
];

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
          <SectionTitle icon={Sparkles}>Summary</SectionTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="leading-relaxed text-pretty whitespace-pre-line sm:text-base">
            {summary ?? "No summary was generated for this meeting."}
          </p>
          {sections.length > 0 && (
            <nav aria-label="Report sections" className="flex flex-wrap gap-2">
              {sections.map(({ anchor, title, icon: Icon, items: sectionItems }) => (
                <a
                  key={anchor}
                  href={`#report-${anchor}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon className="size-3.5 text-primary" />
                  {title}
                  <span className="text-muted-foreground tabular-nums">{sectionItems.length}</span>
                </a>
              ))}
            </nav>
          )}
        </CardContent>
      </Card>

      {sections.map(({ category, title, anchor, icon, items: sectionItems }) => (
        // scroll-mt keeps the section clear of the sticky top bar when jumped to.
        <Card key={category} id={`report-${anchor}`} className="scroll-mt-20">
          <CardHeader>
            <SectionTitle icon={icon} count={sectionItems.length}>
              {title}
            </SectionTitle>
          </CardHeader>
          <CardContent>{renderItems(category, sectionItems)}</CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, count, children }: { icon: LucideIcon; count?: number; children: ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <h2>{children}</h2>
      {count !== undefined && (
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
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

// The owner, date, status, answer or impact shown under an item, depending on its category.
function ItemExtras({ category, item }: { category: ReportCategory; item: ReportItemView }) {
  switch (category) {
    case "TASK":
      return (
        <MetaRow>
          <Meta icon={User}>{item.owner ?? "Unassigned"}</Meta>
          {item.dueDate && <Meta icon={CalendarDays}>Due {formatDay(item.dueDate)}</Meta>}
        </MetaRow>
      );
    case "DEADLINE":
      return (
        <MetaRow>
          <Meta icon={CalendarClock}>{item.dueDate ? formatDay(item.dueDate) : "No exact date given"}</Meta>
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
                answered
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              }
            >
              {answered ? "Answered" : "Unanswered"}
            </Badge>
          </div>
          {item.detail && <Detail label="Answer">{item.detail}</Detail>}
        </>
      );
    }
    case "RISK":
      return item.detail ? <Detail label="Impact">{item.detail}</Detail> : null;
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

function AttendeeList({ items }: { items: ReportItemView[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
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
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
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
