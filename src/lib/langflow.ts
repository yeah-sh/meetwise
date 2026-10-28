// The only place the app talks to AI: runs the Langflow flows for transcription,
// report generation and Q&A (POST {LANGFLOW_BASE_URL}/api/v1/run/{flowId} with an x-api-key header).
// Server-only: never import this from a client component.
export {};
