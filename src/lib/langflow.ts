// The only place the app talks to AI: runs the Langflow flows for transcription,
// report generation and Q&A (POST {LANGFLOW_BASE_URL}/api/v1/run/{flowId} with an x-api-key header).
// Server-only: the import below turns an import from a client component into a build error.
// Endpoints, tweaks and output names are described in langflow/FLOWS.md ("How the app will call it").
import "server-only";
import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

export type LangflowErrorCode =
  | "CONFIG"
  | "INVALID_INPUT"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "AUTH"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "TOO_LARGE"
  | "TWEAKS_REFUSED"
  | "FLOW_FAILED"
  | "BAD_RESPONSE";

// Messages are written for people and never contain the API key, so they are safe to show
// in the UI or store in Meeting.errorMessage.
export class LangflowError extends Error {
  readonly code: LangflowErrorCode;
  readonly status: number | undefined;

  constructor(code: LangflowErrorCode, message: string, status?: number) {
    super(message);
    this.name = "LangflowError";
    this.code = code;
    this.status = status;
  }
}

const ENV_VARS = [
  "LANGFLOW_BASE_URL",
  "LANGFLOW_API_KEY",
  "LANGFLOW_TRANSCRIBE_FLOW_ID",
  "LANGFLOW_REPORT_FLOW_ID",
  "LANGFLOW_QA_FLOW_ID",
  "LANGFLOW_TRANSCRIBE_COMPONENT_ID",
  "LANGFLOW_QA_PROMPT_COMPONENT_ID",
] as const;

type Config = Record<(typeof ENV_VARS)[number], string>;

// Node's fetch stops waiting for response headers after 300 s whatever the signal says, so
// 5 minutes is the real ceiling for transcription. Groq transcribes an hour of audio in well
// under a minute, and the Whisper component gives up on Groq after 300 s anyway.
const STEPS = {
  upload: { label: "uploading the audio", flowVar: "LANGFLOW_TRANSCRIBE_FLOW_ID", timeoutMs: 2 * 60_000 },
  transcribe: {
    label: "transcription",
    flowVar: "LANGFLOW_TRANSCRIBE_FLOW_ID",
    componentVar: "LANGFLOW_TRANSCRIBE_COMPONENT_ID",
    timeoutMs: 5 * 60_000,
  },
  report: { label: "report generation", flowVar: "LANGFLOW_REPORT_FLOW_ID", timeoutMs: 3 * 60_000 },
  qa: {
    label: "answering the question",
    flowVar: "LANGFLOW_QA_FLOW_ID",
    componentVar: "LANGFLOW_QA_PROMPT_COMPONENT_ID",
    timeoutMs: 2 * 60_000,
  },
  delete: { label: "deleting the uploaded audio copy", flowVar: "LANGFLOW_TRANSCRIBE_FLOW_ID", timeoutMs: 15_000 },
} as const;

type Step = keyof typeof STEPS;

// Read on every call, not at import time: standalone scripts load .env.local after their imports run.
function getConfig(): Config {
  const config = {} as Config;
  const missing: string[] = [];
  for (const name of ENV_VARS) {
    const value = process.env[name]?.trim();
    if (value) config[name] = value;
    else missing.push(name);
  }
  if (missing.length > 0) {
    throw new LangflowError(
      "CONFIG",
      `Missing Langflow setting(s): ${missing.join(", ")}. Add them to .env.local (see .env.example) and restart the dev server.`,
    );
  }
  config.LANGFLOW_BASE_URL = config.LANGFLOW_BASE_URL.replace(/\/+$/, "");
  if (!URL.canParse(config.LANGFLOW_BASE_URL)) {
    throw new LangflowError("CONFIG", "LANGFLOW_BASE_URL is not a valid URL. Use the address Langflow shows, e.g. http://localhost:7860.");
  }
  return config;
}

type RequestOptions = { method: "GET" | "POST" | "DELETE"; json?: unknown; form?: FormData };

// Every Langflow call goes through here: adds the API key and a timeout, and turns
// failures into a LangflowError. Returns the parsed JSON body.
async function langflowFetch(step: Step, config: Config, urlPath: string, options: RequestOptions): Promise<unknown> {
  const headers: Record<string, string> = { "x-api-key": config.LANGFLOW_API_KEY };
  if (options.json !== undefined) headers["Content-Type"] = "application/json";

  let status: number;
  let rawText: string;
  try {
    const response = await fetch(`${config.LANGFLOW_BASE_URL}${urlPath}`, {
      method: options.method,
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.form,
      signal: AbortSignal.timeout(STEPS[step].timeoutMs),
    });
    status = response.status;
    rawText = await response.text();
  } catch (error) {
    throw describeFetchFailure(step, config.LANGFLOW_BASE_URL, error);
  }

  const body = parseJson(rawText);
  if (status < 200 || status >= 300) throw describeHttpError(step, status, body, rawText);
  if (body === null) {
    throw new LangflowError("BAD_RESPONSE", `Langflow sent a response that is not JSON during ${STEPS[step].label}.`, status);
  }
  return body;
}

function describeFetchFailure(step: Step, baseUrl: string, error: unknown): LangflowError {
  const { label, timeoutMs } = STEPS[step];
  const name = isRecord(error) ? error.name : undefined;
  const causeCode = isRecord(error) && isRecord(error.cause) ? error.cause.code : undefined;
  // AbortSignal.timeout fires a TimeoutError; undici has its own header and body timeouts.
  if (name === "TimeoutError" || causeCode === "UND_ERR_HEADERS_TIMEOUT" || causeCode === "UND_ERR_BODY_TIMEOUT") {
    return new LangflowError(
      "TIMEOUT",
      `${capitalize(label)} did not finish within ${formatDuration(timeoutMs)} and was stopped. Check that Langflow is responding, then try again.`,
    );
  }
  const reason = typeof causeCode === "string" ? ` (${causeCode})` : "";
  return new LangflowError(
    "UNREACHABLE",
    `Cannot reach Langflow at ${baseUrl}${reason}. Check that Langflow Desktop is running and that LANGFLOW_BASE_URL in .env.local is correct.`,
  );
}

function describeHttpError(step: Step, status: number, body: unknown, rawText: string): LangflowError {
  const stepInfo: { label: string; flowVar: string; componentVar?: string } = STEPS[step];
  const { label, flowVar } = stepInfo;
  const detail = isRecord(body) ? body.detail : undefined;
  const message = truncate(extractMessage(detail, rawText), 500);

  if (status === 401 || status === 403) {
    return new LangflowError(
      "AUTH",
      `Langflow rejected the API key (HTTP ${status}). Check LANGFLOW_API_KEY in .env.local: it must be a key created in the Langflow that owns the flows.`,
      status,
    );
  }
  if (status === 404) {
    return new LangflowError(
      "NOT_FOUND",
      `Langflow could not find the flow for ${label} (HTTP 404). Check ${flowVar} in .env.local. Langflow also answers 404 when LANGFLOW_API_KEY belongs to a different user from the flow's owner.`,
      status,
    );
  }
  if (status === 422 && isRecord(detail) && detail.code === "TWEAKS_REFUSED") {
    const fields = Array.isArray(detail.fields) ? detail.fields.join(", ") : "unknown fields";
    return new LangflowError(
      "TWEAKS_REFUSED",
      `Langflow refused the values the app sends for ${label} (fields: ${fields}). ${message} Check ${stepInfo.componentVar ?? "the component ID"} and the flow's API settings.`,
      status,
    );
  }
  // Checked before rate limits: Groq's "request too large" error also says "rate_limit_exceeded".
  if (status === 413 || /\b413\b|too large/i.test(message)) {
    return new LangflowError(
      "TOO_LARGE",
      `The input was too large for ${label}. Use a shorter recording, or a model or plan with higher limits. Details: ${message}`,
      status,
    );
  }
  if (status === 429 || /rate.?limit|\b429\b|too many requests/i.test(message)) {
    return new LangflowError(
      "RATE_LIMIT",
      `A rate limit was reached during ${label}. Wait a minute and try again. Details: ${message}`,
      status,
    );
  }
  return new LangflowError("FLOW_FAILED", `${capitalize(label)} failed in Langflow (HTTP ${status}): ${message}`, status);
}

// Langflow errors come as {"detail": "text"}, {"detail": {..., "message"}} (e.g. refused tweaks),
// or, when a component fails, {"detail": "<JSON string with a message field>"}.
function extractMessage(detail: unknown, rawText: string): string {
  if (typeof detail === "string") {
    const nested = parseJson(detail);
    return isRecord(nested) && typeof nested.message === "string" ? nested.message : detail;
  }
  if (isRecord(detail) && typeof detail.message === "string") return detail.message;
  if (detail !== undefined) return JSON.stringify(detail);
  return rawText.trim() || "no details";
}

// Finds an output component by its name in the flow and returns its text.
function readOutputText(body: unknown, displayName: string): string {
  const runOutputs = isRecord(body) && Array.isArray(body.outputs) ? body.outputs[0] : undefined;
  const entries: unknown[] = isRecord(runOutputs) && Array.isArray(runOutputs.outputs) ? runOutputs.outputs : [];
  const entry = entries.find((e) => isRecord(e) && e.component_display_name === displayName);
  if (!isRecord(entry)) {
    const found = entries.map((e) => (isRecord(e) ? e.component_display_name : undefined)).filter(Boolean);
    throw new LangflowError(
      "BAD_RESPONSE",
      `Langflow's response has no output named "${displayName}" (found: ${found.join(", ") || "none"}). Rename the output component in the flow to "${displayName}".`,
    );
  }
  // A Text Output keeps its message under results.text, a Chat Output under results.message.
  const results = isRecord(entry.results) ? Object.values(entry.results) : [];
  const text = results.map((r) => (isRecord(r) ? r.text : undefined)).find((t) => typeof t === "string");
  if (typeof text !== "string" || !text.trim()) {
    throw new LangflowError("BAD_RESPONSE", `The "${displayName}" output in Langflow was empty.`);
  }
  return text.trim();
}

// Langflow silently skips a tweak whose component ID is not in the flow, or whose field is missing
// or fed by a connection. The flow would then run with the values saved in it (e.g. the test
// recording), so check once per server process that the tweaks will land.
const checkedComponents = new Set<string>();

async function ensureTweakTarget(step: "transcribe" | "qa", config: Config, fields: string[]): Promise<void> {
  const { flowVar, componentVar } = STEPS[step];
  const flowId = config[flowVar];
  const componentId = config[componentVar];
  const cacheKey = `${flowId}/${componentId}`;
  if (checkedComponents.has(cacheKey)) return;

  const flow = await langflowFetch(step, config, `/api/v1/flows/${encodeURIComponent(flowId)}`, { method: "GET" });
  const data = isRecord(flow) && isRecord(flow.data) ? flow.data : {};
  const nodes: unknown[] = Array.isArray(data.nodes) ? data.nodes : [];
  const edges: unknown[] = Array.isArray(data.edges) ? data.edges : [];
  const node = nodes.find((n) => isRecord(n) && n.id === componentId);
  const template = isRecord(node) && isRecord(node.data) && isRecord(node.data.node) ? node.data.node.template : undefined;

  const fix = `Copy the current ID into ${componentVar} in .env.local (see langflow/FLOWS.md, step 5) and restart the dev server.`;
  if (!isRecord(template)) {
    throw new LangflowError("CONFIG", `The flow in ${flowVar} has no component "${componentId}". ${fix}`);
  }
  for (const field of fields) {
    if (!isRecord(template[field])) {
      throw new LangflowError("CONFIG", `Component "${componentId}" has no "${field}" field, so it is the wrong component. ${fix}`);
    }
    const connected = edges.some(
      (e) =>
        isRecord(e) && e.target === componentId && isRecord(e.data) && isRecord(e.data.targetHandle) && e.data.targetHandle.fieldName === field,
    );
    if (connected) {
      throw new LangflowError(
        "CONFIG",
        `The "${field}" field of "${componentId}" has an incoming connection, so Langflow would ignore the app's value. Remove that connection in the flow.`,
      );
    }
  }
  checkedComponents.add(cacheKey);
}

// Copies a local audio file into Langflow's storage (Langflow cannot read files outside it)
// and returns the stored path, "<flowId>/<timestamp>_<file name>".
export async function uploadFileToLangflow(filePath: string): Promise<string> {
  const config = getConfig();
  const fileStats = await stat(filePath).catch(() => null);
  if (!fileStats?.isFile()) {
    throw new LangflowError("INVALID_INPUT", `Audio file not found: ${path.basename(filePath)}`);
  }

  const form = new FormData();
  // Langflow keeps the file name, and the Whisper component checks its extension.
  form.append("file", await openAsBlob(filePath), path.basename(filePath));
  const flowId = encodeURIComponent(config.LANGFLOW_TRANSCRIBE_FLOW_ID);
  const body = await langflowFetch("upload", config, `/api/v1/files/upload/${flowId}`, { method: "POST", form });

  const storedPath = isRecord(body) ? body.file_path : undefined;
  if (typeof storedPath !== "string" || !storedPath) {
    throw new LangflowError("BAD_RESPONSE", "Langflow accepted the upload but did not return the stored file path.");
  }
  return storedPath;
}

// Best effort: a leftover copy only takes disk space, so a failure here is logged, not thrown.
async function deleteLangflowFile(config: Config, storedPath: string): Promise<void> {
  const [folder, ...rest] = storedPath.split("/");
  const urlPath = `/api/v1/files/delete/${encodeURIComponent(folder)}/${encodeURIComponent(rest.join("/"))}`;
  try {
    await langflowFetch("delete", config, urlPath, { method: "DELETE" });
  } catch (error) {
    console.warn(`[langflow] Could not delete the uploaded copy ${storedPath}:`, error instanceof Error ? error.message : error);
  }
}

// Uploads the audio, runs the Transcribe flow on it and returns the transcript.
export async function transcribeAudio(filePath: string): Promise<string> {
  const config = getConfig();
  await ensureTweakTarget("transcribe", config, ["audio_file"]);
  const storedPath = await uploadFileToLangflow(filePath);
  try {
    const flowId = encodeURIComponent(config.LANGFLOW_TRANSCRIBE_FLOW_ID);
    const body = await langflowFetch("transcribe", config, `/api/v1/run/${flowId}`, {
      method: "POST",
      json: {
        output_type: "text",
        input_type: "text",
        tweaks: { [config.LANGFLOW_TRANSCRIBE_COMPONENT_ID]: { audio_file: storedPath } },
      },
    });
    return readOutputText(body, "Transcript Output");
  } finally {
    await deleteLangflowFile(config, storedPath);
  }
}

// Runs the Report flow and returns the model's raw text (JSON, checked by parseReport in report-schema.ts).
export async function generateReport(transcript: string): Promise<string> {
  const config = getConfig();
  if (!transcript.trim()) {
    throw new LangflowError("INVALID_INPUT", "Cannot generate a report from an empty transcript.");
  }
  const flowId = encodeURIComponent(config.LANGFLOW_REPORT_FLOW_ID);
  const body = await langflowFetch("report", config, `/api/v1/run/${flowId}`, {
    method: "POST",
    json: { input_value: transcript, input_type: "text", output_type: "text" },
  });
  return readOutputText(body, "Report Output");
}

export type AskMeetingInput = {
  meetingId: string;
  question: string;
  transcript: string;
  summary?: string | null;
};

// Asks the Q&A flow a question about one meeting and returns the answer.
export async function askMeeting({ meetingId, question, transcript, summary }: AskMeetingInput): Promise<string> {
  const config = getConfig();
  if (!meetingId.trim() || !question.trim() || !transcript.trim()) {
    throw new LangflowError("INVALID_INPUT", "A question needs a meeting id, the question text and the meeting's transcript.");
  }
  await ensureTweakTarget("qa", config, ["transcript", "summary"]);
  const flowId = encodeURIComponent(config.LANGFLOW_QA_FLOW_ID);
  const body = await langflowFetch("qa", config, `/api/v1/run/${flowId}`, {
    method: "POST",
    json: {
      input_value: question.trim(),
      input_type: "chat",
      output_type: "chat",
      // Langflow keys chat memory by session_id, so the meeting id keeps each meeting's history separate.
      session_id: meetingId,
      tweaks: { [config.LANGFLOW_QA_PROMPT_COMPONENT_ID]: { transcript, summary: summary ?? "" } },
    },
  });
  return readOutputText(body, "Answer Output");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDuration(ms: number): string {
  return ms >= 60_000 ? `${ms / 60_000} minutes` : `${ms / 1000} seconds`;
}
