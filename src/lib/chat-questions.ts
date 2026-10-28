// Chat question rules and suggestions shared by server and client components.
import type { ReportCategory } from "@/generated/prisma/enums";

// Checked by the chat panel as the user types and again by the API (validation.ts).
export const MAX_QUESTION_LENGTH = 1000;

// Spoken questions: the recorder stops by itself after MAX_VOICE_SECONDS, and POST /api/transcribe-question
// refuses recordings over MAX_VOICE_MB (30 seconds of Opus audio is well under 1 MB).
export const MAX_VOICE_SECONDS = 30;
export const MAX_VOICE_MB = 5;

const SUGGESTION_COUNT = 4;

// In order of preference. Each is offered only when the report has items of its category, so a
// chip never leads to "that wasn't discussed".
const REPORT_SUGGESTIONS: { category: ReportCategory; question: string }[] = [
  { category: "TASK", question: "What are the tasks and who owns them?" },
  { category: "DECISION", question: "What decisions were made?" },
  { category: "QUESTION", question: "Which questions are still unanswered?" },
  { category: "RISK", question: "What risks were raised?" },
  { category: "DEADLINE", question: "What are the deadlines?" },
  { category: "FOLLOW_UP", question: "What follow-ups were agreed?" },
  { category: "AGENDA", question: "What was on the agenda?" },
  { category: "ATTENDEE", question: "Who attended, and what were their roles?" },
  { category: "INSIGHT", question: "What were the key insights?" },
];

// Fill the remaining chips when the report has fewer than four kinds of items.
const GENERAL_SUGGESTIONS = [
  "Summarise the meeting in a few sentences.",
  "What were the main topics discussed?",
  "What happens next?",
  "Was anything left unresolved?",
];

type ReportItemLike = { category: ReportCategory; status: string | null };

// The four questions offered as chips in an empty chat, built from the meeting's report items.
export function suggestQuestions(items: ReportItemLike[]): string[] {
  const fromReport = REPORT_SUGGESTIONS.filter(({ category }) =>
    items.some(
      (item) =>
        item.category === category &&
        // "still unanswered" only makes sense if at least one question is.
        (category !== "QUESTION" || item.status?.toLowerCase() !== "answered"),
    ),
  ).map(({ question }) => question);
  return [...fromReport, ...GENERAL_SUGGESTIONS].slice(0, SUGGESTION_COUNT);
}
