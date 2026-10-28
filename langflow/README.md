# langflow

Langflow assets used by MeetWise. Build the flows by hand in Langflow Desktop by following **[FLOWS.md](FLOWS.md)**.

- **Transcribe flow**: meeting audio → Groq Whisper → transcript
- **Report flow**: transcript → structured report (summary, tasks, decisions, …)
- **Q&A flow**: transcript + question → answer drawn only from that transcript

| Path | Contents |
| --- | --- |
| `FLOWS.md` | Step-by-step build instructions, API keys, IDs, and how the app calls each flow |
| `components/groq_whisper.py` | "Groq Whisper Transcriber" custom component (paste into a Custom Component) |
| `prompts/report_prompt.md` | Report prompt (paste into the Report flow's Prompt Template) |
| `prompts/qa_prompt.md` | Q&A prompt (paste into the Q&A flow's Prompt Template) |
| `flows/` | Exported flow JSON (Share → Export, without API keys) |

Put the flow and component IDs in `.env.local` (`LANGFLOW_*`). The Groq API key is stored in Langflow as a global variable, not in this app.
