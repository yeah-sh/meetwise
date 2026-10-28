# langflow

Exported Langflow flows (JSON) and custom component code used by MeetWise.

- **Transcribe flow**: meeting audio → Groq Whisper → transcript
- **Report flow**: transcript → structured report (summary, tasks, decisions, …)
- **Q&A flow**: transcript + question → answer drawn only from that transcript

Export each flow from Langflow Desktop and save it here so the flows are versioned with the app. Put the flow IDs in `.env.local` (`LANGFLOW_*_FLOW_ID`). The Groq API key is stored in Langflow (as a global variable), not in this app.
