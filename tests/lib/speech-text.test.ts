import { describe, expect, it } from "vitest";
import { speechPieces } from "@/lib/speech-text";

describe("speechPieces: Markdown becomes plain text", () => {
  it("drops emphasis and inline code markers", () => {
    expect(speechPieces("**Lena** owns the _release_ checklist in `release.md`.")).toEqual([
      "Lena owns the release checklist in release.md.",
    ]);
  });

  it("reads headings and each list item as its own piece", () => {
    expect(speechPieces("## Tasks\n\n- Marcus: hand over the designs\n- Lena: own the checklist")).toEqual([
      "Tasks",
      "Marcus: hand over the designs",
      "Lena: own the checklist",
    ]);
  });

  it("reads numbered lists and block quotes", () => {
    expect(speechPieces("1. First step\n2. Second step\n\n> Quoted line")).toEqual(["First step", "Second step", "Quoted line"]);
  });

  it("reads a link by its text", () => {
    expect(speechPieces("See [the launch plan](https://example.com/plan) for details.")).toEqual([
      "See the launch plan for details.",
    ]);
  });

  it("reads a bare URL as its site name", () => {
    expect(speechPieces("It is on https://www.example.com/docs/beta?x=1.")).toEqual(["It is on example.com."]);
  });

  it("skips images", () => {
    expect(speechPieces("![Revenue chart](chart.png)\n\nRevenue grew.")).toEqual(["Revenue grew."]);
  });

  // Tags become spaces (so "one<br>two" stays two words); a space before "." is not heard.
  it("removes HTML tags", () => {
    expect(speechPieces("Launch is <b>Friday</b>.")).toEqual(["Launch is Friday ."]);
    expect(speechPieces("one<br>two")).toEqual(["one two"]);
  });

  it("reads a code block's text", () => {
    expect(speechPieces("```\nnpm run dev\n```")).toEqual(["npm run dev"]);
  });

  it("drops table pipes and dashes the parser leaves as text", () => {
    const [piece] = speechPieces("| Owner | Task |\n| --- | --- |\n| Lena | Checklist |");
    expect(piece).not.toMatch(/[|]|--/);
    expect(piece).toContain("Lena");
  });

  it("returns nothing for empty or symbol-only input", () => {
    expect(speechPieces("")).toEqual([]);
    expect(speechPieces("   \n\n  ")).toEqual([]);
    expect(speechPieces("***")).toEqual([]);
  });
});

describe("speechPieces: symbols a voice would read out", () => {
  it("expands e.g. and i.e.", () => {
    expect(speechPieces("Some tasks, e.g. the checklist, i.e. Lena's job, are late.")).toEqual([
      "Some tasks, for example the checklist, that is Lena's job, are late.",
    ]);
  });

  it('reads "#3" as "number 3"', () => {
    expect(speechPieces("Ticket #3 is blocked.")).toEqual(["Ticket number 3 is blocked."]);
  });

  it("removes emoji", () => {
    expect(speechPieces("Great news 🎉 the beta ships ✅")).toEqual(["Great news the beta ships"]);
  });

  it("turns a quotation into a pause instead of reading the quote marks", () => {
    expect(speechPieces('Priya said "we ship on Friday".')).toEqual(["Priya said, we ship on Friday."]);
  });

  it('drops the brackets of "[…]" in a quote', () => {
    expect(speechPieces("She said it was […] fine.")).toEqual(["She said it was … fine."]);
  });
});

describe("speechPieces: splitting for the browser's speech engine", () => {
  it("splits a paragraph into sentences", () => {
    expect(speechPieces("The beta launches on 20 November. QA gets the build first! Any questions?")).toEqual([
      "The beta launches on 20 November.",
      "QA gets the build first!",
      "Any questions?",
    ]);
  });

  it("does not split at a decimal point", () => {
    expect(speechPieces("Revenue grew 2.5 percent.")).toEqual(["Revenue grew 2.5 percent."]);
  });

  it("cuts a long sentence at a comma, keeping every piece at most 160 characters", () => {
    const sentence =
      "The team agreed to move the beta launch to the twentieth of November, because the email provider migration " +
      "is still unfinished and QA needs at least a week with the final build before anything can ship to real users.";
    const pieces = speechPieces(sentence);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces[0]).toBe("The team agreed to move the beta launch to the twentieth of November,");
    expect(pieces.every((piece) => piece.length <= 160)).toBe(true);
    expect(pieces.join(" ")).toBe(sentence);
  });

  it("cuts at a space when there is no comma", () => {
    const sentence = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");
    const pieces = speechPieces(sentence);
    expect(pieces.every((piece) => piece.length <= 160)).toBe(true);
    expect(pieces.join(" ")).toBe(sentence);
  });

  it("cuts a single word longer than the limit", () => {
    const pieces = speechPieces("x".repeat(400));
    expect(pieces.map((piece) => piece.length)).toEqual([160, 160, 80]);
  });
});
