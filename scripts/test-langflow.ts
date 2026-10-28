// End-to-end check of the three Langflow flows: transcribes an audio file, generates and validates
// a report, then asks one question the meeting answers and one it does not. Never touches the database.
// Run from the project root:
//   npm run test:langflow -- "C:\path\to\meeting.m4a" ["answerable question"] ["unanswerable question"]
// (The npm script runs tsx with --conditions=react-server so that `import "server-only"` loads.)
import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { askMeeting, generateReport, LangflowError, transcribeAudio } from "../src/lib/langflow";
import { parseReport } from "../src/lib/report-schema";

// Standalone script, so load .env.local ourselves (Next.js is not running). langflow.ts reads
// its settings when a function is called, so loading them after the imports is fine.
loadEnvConfig(process.cwd(), true);

const DEFAULT_ANSWERABLE = "What was this meeting mainly about, and what was decided?";
// General knowledge the model knows but a meeting almost never covers: the answer should say
// it was not discussed, not "Canberra".
const DEFAULT_UNANSWERABLE = "What is the capital of Australia?";
const PREVIEW_CHARS = 800;

function printUsage() {
  console.log('Usage: npm run test:langflow -- "C:\\path\\to\\meeting.m4a" ["answerable question"] ["unanswerable question"]');
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

// Prints a step header, runs the step and prints how long it took (even if it fails).
async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  console.log(`\n=== ${label} ===`);
  const start = performance.now();
  try {
    return await run();
  } finally {
    console.log(`(took ${seconds(performance.now() - start)})`);
  }
}

async function main(): Promise<number> {
  const [audioArg, answerable = DEFAULT_ANSWERABLE, unanswerable = DEFAULT_UNANSWERABLE] = process.argv.slice(2);
  if (!audioArg) {
    printUsage();
    return 1;
  }
  const audioPath = path.resolve(audioArg);
  if (!statSync(audioPath, { throwIfNoEntry: false })?.isFile()) {
    console.error(`Audio file not found: ${audioPath}`);
    printUsage();
    return 1;
  }
  const totalStart = performance.now();

  const transcript = await timed("1. Transcribe", () => transcribeAudio(audioPath));
  const preview = transcript.length > PREVIEW_CHARS ? `, first ${PREVIEW_CHARS} shown` : "";
  console.log(`Transcript (${transcript.length} characters${preview}):\n${transcript.slice(0, PREVIEW_CHARS)}`);

  const rawReport = await timed("2. Generate report", () => generateReport(transcript));
  console.log(`Raw report: ${rawReport.length} characters`);

  const parsed = await timed("3. Validate report", async () => parseReport(rawReport));
  if (parsed.success) {
    console.log(JSON.stringify(parsed.data, null, 2));
  } else {
    console.error(`INVALID: ${parsed.error}\n\nRaw report text:\n${rawReport}`);
  }

  // A fresh session id per run, so Langflow's chat memory starts empty.
  const sessionId = `test-${randomUUID()}`;
  console.log(`\nQ&A session id: ${sessionId}`);
  const summary = parsed.success ? parsed.data.summary : "";
  const questions: [string, string][] = [
    ["4. Ask a question the meeting answers", answerable],
    ["5. Ask a question the meeting does not answer", unanswerable],
  ];
  for (const [label, question] of questions) {
    const answer = await timed(label, () => askMeeting({ meetingId: sessionId, question, transcript, summary }));
    console.log(`Q: ${question}\nA: ${answer}`);
  }

  console.log(`\nTotal: ${seconds(performance.now() - totalStart)}`);
  if (!parsed.success) console.error("Finished, but the report did not pass validation (see step 3).");
  return parsed.success ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // LangflowError messages are already readable, so skip the stack trace for them.
    if (error instanceof LangflowError) console.error(`\n[${error.code}] ${error.message}`);
    else console.error(error);
    process.exitCode = 1;
  },
);
