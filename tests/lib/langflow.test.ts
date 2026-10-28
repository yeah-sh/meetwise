// src/lib/langflow.ts against a stubbed fetch: how Langflow's answers and errors become results and
// short, readable LangflowError messages. No Langflow is needed.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateReport, LangflowError } from "@/lib/langflow";

const API_KEY = "test-api-key-123";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("LANGFLOW_BASE_URL", "http://localhost:7860/");
  vi.stubEnv("LANGFLOW_API_KEY", API_KEY);
  vi.stubEnv("LANGFLOW_TRANSCRIBE_FLOW_ID", "transcribe-flow");
  vi.stubEnv("LANGFLOW_REPORT_FLOW_ID", "report-flow");
  vi.stubEnv("LANGFLOW_QA_FLOW_ID", "qa-flow");
  vi.stubEnv("LANGFLOW_TRANSCRIBE_COMPONENT_ID", "CustomComponent-abc12");
  vi.stubEnv("LANGFLOW_QA_PROMPT_COMPONENT_ID", "Prompt Template-xyz34");
  vi.stubGlobal("fetch", fetchMock);
});

// What /api/v1/run answers when a component fails: {"detail": "<JSON with a message>"}.
function componentFailure(message: string | string[], status = 500): Response {
  return Response.json({ detail: JSON.stringify({ message, traceback: null }) }, { status });
}

async function reportError(): Promise<LangflowError> {
  const error = await generateReport("Priya: let's ship on Friday.").catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(LangflowError);
  return error as LangflowError;
}

describe("generateReport", () => {
  it("sends the transcript with the API key and returns the Report Output text", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        outputs: [{ outputs: [{ component_display_name: "Report Output", results: { text: { text: ' {"title": "x"} ' } } }] }],
      }),
    );
    await expect(generateReport("Priya: let's ship on Friday.")).resolves.toBe('{"title": "x"}');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:7860/api/v1/run/report-flow");
    expect(new Headers(init?.headers).get("x-api-key")).toBe(API_KEY);
    expect(JSON.parse(String(init?.body))).toMatchObject({ input_value: "Priya: let's ship on Friday." });
  });

  it("names the missing output when the flow's output was renamed", async () => {
    fetchMock.mockResolvedValue(Response.json({ outputs: [{ outputs: [{ component_display_name: "Text Output" }] }] }));
    expect((await reportError()).message).toMatch(/no output named "Report Output" \(found: Text Output\)/);
  });
});

describe("Langflow error messages", () => {
  it("drops Langflow's 'Error running graph' and 'Error building Component' wrappers", async () => {
    fetchMock.mockResolvedValue(
      componentFailure(
        "Error running graph: Error building Component Groq Whisper Transcriber: \n\nGroq rejected the API key (HTTP 401). Check the GROQ_API_KEY global variable in Langflow.",
      ),
    );
    const error = await reportError();
    expect(error.code).toBe("FLOW_FAILED");
    expect(error.message).toBe(
      "Report generation failed in Langflow (HTTP 500): Groq rejected the API key (HTTP 401). Check the GROQ_API_KEY global variable in Langflow.",
    );
  });

  it("keeps only the provider's own message from an OpenAI-client error", async () => {
    fetchMock.mockResolvedValue(
      componentFailure(
        "Error running graph: Error building Component Language Model: \n\nError code: 401 - {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}",
      ),
    );
    expect((await reportError()).message).toBe("Report generation failed in Langflow (HTTP 500): Invalid API Key (HTTP 401)");
  });

  it("still recognises a provider rate limit after shortening", async () => {
    fetchMock.mockResolvedValue(
      componentFailure(
        "Error running graph: Error building Component Language Model: \n\nError code: 429 - {'error': {'message': 'Rate limit reached for model `llama-3.3-70b-versatile` on tokens per minute (TPM). Please try again in 7.5s.', 'type': 'tokens', 'code': 'rate_limit_exceeded'}}",
      ),
    );
    const error = await reportError();
    expect(error.code).toBe("RATE_LIMIT");
    expect(error.message).toBe(
      "A rate limit was reached during report generation. Wait a minute and try again. Details: Rate limit reached for model `llama-3.3-70b-versatile` on tokens per minute (TPM). Please try again in 7.5s. (HTTP 429)",
    );
  });

  it('still recognises "request too large" after shortening', async () => {
    fetchMock.mockResolvedValue(
      componentFailure(
        `Error running graph: Error building Component Language Model: \n\nError code: 413 - {'error': {'message': "Request too large for model on tokens per minute (TPM): Limit 12000, Requested 30000. Can't fit.", 'type': 'tokens', 'code': 'rate_limit_exceeded'}}`,
      ),
    );
    const error = await reportError();
    expect(error.code).toBe("TOO_LARGE");
    expect(error.message).toContain("Details: Request too large for model on tokens per minute (TPM): Limit 12000, Requested 30000. Can't fit. (HTTP 413)");
  });

  it("joins a message sent as a list", async () => {
    fetchMock.mockResolvedValue(componentFailure(["Error running graph: First problem.", "Second problem."]));
    expect((await reportError()).message).toBe("Report generation failed in Langflow (HTTP 500): First problem. Second problem.");
  });

  it("shortens a plain-text detail too", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "Error running graph: Flow has no input." }, { status: 400 }));
    expect((await reportError()).message).toBe("Report generation failed in Langflow (HTTP 400): Flow has no input.");
  });

  it("cuts a very long message so it fits in Meeting.errorMessage", async () => {
    fetchMock.mockResolvedValue(componentFailure(`Error running graph: ${"x".repeat(1000)}`));
    const { message } = await reportError();
    expect(message.endsWith("…")).toBe(true);
    expect(message.length).toBeLessThanOrEqual(400);
  });

  it("explains a refused API key without echoing it", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "Invalid API key" }, { status: 403 }));
    const error = await reportError();
    expect(error.code).toBe("AUTH");
    expect(error.message).toMatch(/Check LANGFLOW_API_KEY in \.env\.local/);
    expect(error.message).not.toContain(API_KEY);
  });

  it("says when Langflow cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } }));
    const error = await reportError();
    expect(error.code).toBe("UNREACHABLE");
    expect(error.message).toBe(
      "Cannot reach Langflow at http://localhost:7860 (ECONNREFUSED). Check that Langflow Desktop is running and that LANGFLOW_BASE_URL in .env.local is correct.",
    );
  });

  it("lists missing settings without calling Langflow", async () => {
    vi.stubEnv("LANGFLOW_API_KEY", "");
    const error = await reportError();
    expect(error.code).toBe("CONFIG");
    expect(error.message).toMatch(/Missing Langflow setting\(s\): LANGFLOW_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
