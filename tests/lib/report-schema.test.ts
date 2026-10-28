import { describe, expect, it } from "vitest";
import { parseReport, stripCodeFences } from "@/lib/report-schema";

// A complete report as the prompt (langflow/prompts/report_prompt.md) asks for it.
const validReport = {
  title: "Weekly product sync",
  description: "Beta launch planning",
  summary: "The team set the beta launch for 20 November.",
  tasks: [{ text: "Hand over the email designs", owner: "Marcus", dueDate: "2026-11-02" }],
  decisions: [{ text: "Beta launches on 20 November" }],
  questions: [{ text: "Does legal need to review the terms?", status: "answered", answer: "Yes, by 15 November." }],
  insights: [{ text: "Most beta users sign up from mobile" }],
  deadlines: [{ text: "QA receives the build", dueDate: "2026-11-13" }],
  attendees: [{ name: "Priya", role: "Meeting lead" }],
  followUps: [{ text: "Check with the email provider", owner: "Lena" }],
  risks: [{ text: "Email migration unfinished", impact: "Emails may not send" }],
  agenda: [{ text: "Beta launch date" }],
};

function reportWith(changes: Record<string, unknown>): string {
  return JSON.stringify({ ...validReport, ...changes });
}

function reportWithout(...fields: string[]): string {
  return JSON.stringify(Object.fromEntries(Object.entries(validReport).filter(([key]) => !fields.includes(key))));
}

function parseOrThrow(raw: string) {
  const result = parseReport(raw);
  if (!result.success) throw new Error(result.error);
  return result.data;
}

describe("parseReport: valid JSON", () => {
  it("accepts a complete report", () => {
    expect(parseOrThrow(JSON.stringify(validReport))).toEqual(validReport);
  });

  it("trims text fields", () => {
    const data = parseOrThrow(reportWith({ title: "  Weekly sync  ", decisions: [{ text: " Ship it " }] }));
    expect(data.title).toBe("Weekly sync");
    expect(data.decisions).toEqual([{ text: "Ship it" }]);
  });

  it("lower-cases a question status", () => {
    const data = parseOrThrow(reportWith({ questions: [{ text: "Budget?", status: " Unanswered ", answer: null }] }));
    expect(data.questions[0].status).toBe("unanswered");
  });
});

describe("parseReport: JSON wrapped in code fences or text", () => {
  it("accepts a ```json fence", () => {
    expect(parseOrThrow("```json\n" + JSON.stringify(validReport) + "\n```").title).toBe(validReport.title);
  });

  it("accepts a fence without a language", () => {
    expect(parseOrThrow("```\n" + JSON.stringify(validReport) + "\n```").title).toBe(validReport.title);
  });

  it("keeps only the object when the model adds text around it", () => {
    const raw = `Here is the report:\n${JSON.stringify(validReport)}\nLet me know if you need more.`;
    expect(parseOrThrow(raw).title).toBe(validReport.title);
  });

  it("stripCodeFences leaves plain JSON unchanged", () => {
    expect(stripCodeFences('  {"a": 1}  ')).toBe('{"a": 1}');
  });

  it("rejects text that is not JSON", () => {
    const result = parseReport("Sorry, I cannot summarise this meeting.");
    expect(result).toMatchObject({ success: false });
    expect(!result.success && result.error).toMatch(/not valid JSON/);
  });

  it("rejects a truncated object", () => {
    expect(parseReport(JSON.stringify(validReport).slice(0, -10)).success).toBe(false);
  });
});

describe("parseReport: missing fields", () => {
  it.each(["title", "description", "summary"])("rejects a report without %s", (field) => {
    const result = parseReport(reportWithout(field));
    expect(result.success).toBe(false);
    expect(!result.success && result.error).toContain(field);
  });

  it("rejects an empty summary", () => {
    expect(parseReport(reportWith({ summary: "   " })).success).toBe(false);
  });

  it("treats missing or null lists as empty", () => {
    const withoutLists = JSON.parse(reportWithout("tasks", "risks"));
    const data = parseOrThrow(JSON.stringify({ ...withoutLists, agenda: null }));
    expect(data.tasks).toEqual([]);
    expect(data.risks).toEqual([]);
    expect(data.agenda).toEqual([]);
  });

  it('turns a missing, empty or "null" owner into null', () => {
    const data = parseOrThrow(
      reportWith({
        tasks: [{ text: "A", dueDate: null }, { text: "B", owner: "", dueDate: null }, { text: "C", owner: "null", dueDate: null }],
      }),
    );
    expect(data.tasks.map((task) => task.owner)).toEqual([null, null, null]);
  });

  it("rejects an item without text", () => {
    expect(parseReport(reportWith({ decisions: [{ text: "" }] })).success).toBe(false);
  });

  it("rejects a list of the wrong type", () => {
    expect(parseReport(reportWith({ tasks: "none" })).success).toBe(false);
  });

  it("rejects an unknown question status", () => {
    expect(parseReport(reportWith({ questions: [{ text: "Budget?", status: "maybe", answer: null }] })).success).toBe(false);
  });
});

describe("parseReport: dates", () => {
  function dueDateOf(value: unknown) {
    return parseOrThrow(reportWith({ deadlines: [{ text: "Launch", dueDate: value }] })).deadlines[0].dueDate;
  }

  it("keeps a real YYYY-MM-DD date", () => {
    expect(dueDateOf("2026-11-20")).toBe("2026-11-20");
  });

  it("trims spaces around a date", () => {
    expect(dueDateOf(" 2026-11-20 ")).toBe("2026-11-20");
  });

  it.each([
    ["a weekday", "Friday"],
    ["a relative date", "next week"],
    ["a day that does not exist", "2026-02-30"],
    ["a month that does not exist", "2026-13-01"],
    ["another format", "20/11/2026"],
    ["a date with a time", "2026-11-20T10:00:00Z"],
    ["a number", 20261120],
    ["an empty string", ""],
  ])("turns %s into null", (_label, value) => {
    expect(dueDateOf(value)).toBeNull();
  });

  it("accepts 29 February in a leap year only", () => {
    expect(dueDateOf("2028-02-29")).toBe("2028-02-29");
    expect(dueDateOf("2027-02-29")).toBeNull();
  });
});
