// Validates the report JSON the Report flow returns. The shape is defined in
// langflow/prompts/report_prompt.md; keep the two in sync.
// No server-only code here, so client components may import the MeetingReport type.
import { z } from "zod";

// The schema forgives a few small model slips, so one stray value does not fail a whole meeting
// after a long transcription. Wrong types and a missing title or summary are still errors.

const requiredText = z.string().trim().min(1, "must not be empty");

// The prompt asks for null; models sometimes write "", "null" or leave the key out.
const nullableText = z.preprocess(
  (value) => (value === undefined || (typeof value === "string" && ["", "null"].includes(value.trim().toLowerCase())) ? null : value),
  z.string().trim().nullable(),
);

// A real calendar date as YYYY-MM-DD. Anything else (e.g. "Friday") becomes null; the prompt
// keeps vague wording in the item's text anyway.
const isoDate = z.preprocess(
  (value) => (typeof value === "string" && isRealDate(value.trim()) ? value.trim() : null),
  z.string().nullable(),
);

const questionStatus = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["answered", "unanswered"]),
);

// A missing or null list counts as empty.
function list<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => value ?? [], z.array(item));
}

export const reportSchema = z.object({
  title: requiredText,
  description: requiredText,
  summary: requiredText,
  tasks: list(z.object({ text: requiredText, owner: nullableText, dueDate: isoDate })),
  decisions: list(z.object({ text: requiredText })),
  questions: list(z.object({ text: requiredText, status: questionStatus, answer: nullableText })),
  insights: list(z.object({ text: requiredText })),
  deadlines: list(z.object({ text: requiredText, dueDate: isoDate })),
  attendees: list(z.object({ name: requiredText, role: nullableText })),
  followUps: list(z.object({ text: requiredText, owner: nullableText })),
  risks: list(z.object({ text: requiredText, impact: nullableText })),
  agenda: list(z.object({ text: requiredText })),
});

export type MeetingReport = z.infer<typeof reportSchema>;

export type ParseReportResult = { success: true; data: MeetingReport } | { success: false; error: string };

// Removes a ```json ... ``` fence if the model added one. If there is still text around the
// object (e.g. "Here is the report: {...}"), keeps only the outermost {...}.
export function stripCodeFences(raw: string): string {
  let text = raw.trim();
  const fenced = text.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fenced) text = fenced[1].trim();
  if (!text.startsWith("{") || !text.endsWith("}")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }
  return text;
}

// Parses and validates the raw text from generateReport().
export function parseReport(raw: string): ParseReportResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFences(raw));
  } catch (error) {
    return { success: false, error: `Report is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const result = reportSchema.safeParse(json);
  if (!result.success) {
    return { success: false, error: `Report does not match the expected shape:\n${z.prettifyError(result.error)}` };
  }
  return { success: true, data: result.data };
}

function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  // Rejects dates like 2026-02-30, which Date would roll over into March.
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}
