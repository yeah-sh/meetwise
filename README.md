# MeetWise

MeetWise is a meeting assistant that runs on your own computer. Upload a recording of a meeting and MeetWise transcribes it, then writes a structured report: summary, tasks, decisions, open questions, insights, deadlines, attendees, follow-ups, risks and agenda. You can then chat with that meeting, by typing or by speaking, and hear the answers read aloud. **Answers come only from that meeting's transcript.** If something was not discussed, MeetWise says so instead of guessing.

## Features

- **Upload a recording:** MP3, MP4, M4A, WAV, WebM, Ogg or FLAC, up to 25 MB by default. The type and size are checked in the browser and again on the server.
- **Live progress:** Uploading → Transcribing → Analysing → Ready. A failed meeting can be retried, and a retry reuses a transcript that was already made.
- **Transcription** with Groq Whisper (`whisper-large-v3-turbo`), called from a Langflow flow.
- **Structured report** with a summary and nine sections. The model's JSON is checked before it is saved, so a malformed report never reaches the page.
- **Meetings dashboard** showing each meeting's status and its number of tasks, decisions and risks, with a delete button.
- **Meeting page** with an audio player that supports seeking, the report, and a searchable transcript that highlights every match.
- **Chat with the meeting:** suggested questions built from the report, follow-up questions that remember the conversation (kept separately for each meeting), Retry after a failure, and Clear chat.
- **Voice questions:** a mic button records up to 30 seconds, Whisper transcribes it, and the question is sent. Tick "Review before sending" to edit it first.
- **Spoken answers** using the browser's own text-to-speech. Each answer has a speaker button. Answers to spoken questions are read out automatically, and the gear menu lets you choose the voice and speed.
- **Light and dark theme.**

## Architecture

```mermaid
flowchart LR
    B["Browser<br/>pages · mic recording · speech"] -->|"/api/* (JSON, uploads)"| N["Next.js API routes<br/>src/app/api"]
    N -->|"Prisma"| DB1[("PostgreSQL<br/>meeting_app")]
    N -->|"REST /api/v1 + API key<br/>src/lib/langflow.ts"| L["Langflow Desktop<br/>Transcribe · Report · Q&A flows"]
    L -->|"Whisper speech-to-text<br/>LLM (gpt-oss-120b)"| G["Groq API"]
    L -->|"flows, chat memory, variables"| DB2[("PostgreSQL<br/>langflow")]
```

- The browser only ever talks to the app's own API. It never sees API keys, Langflow or storage paths.
- **Every AI step goes through Langflow**, and only `src/lib/langflow.ts` calls Langflow. The Groq API key is stored in Langflow, not in this app.
- **Upload:** the API saves the file to `storage/uploads/`, creates the meeting and answers at once. Processing then runs in the background (Next.js `after()`):
  1. The **Transcribe** flow turns the audio into text.
  2. The **Report** flow turns the text into JSON.
  3. The app validates the JSON (`report-schema.ts`) and saves the report in one transaction.
- **Chat:** each question goes to the **Q&A** flow together with the meeting's transcript and summary. The meeting id is sent as `session_id`, so Langflow keeps a separate memory for each meeting.
- **Voice:** spoken questions use the same Transcribe flow. Spoken answers use the browser's `speechSynthesis`, so no audio goes to the server.

| API route | What it does |
| --- | --- |
| `POST /api/meetings` | Uploads a recording (multipart: `audio`, optional `title`) and starts processing (answers 202) |
| `GET /api/meetings/[id]/status` | Processing status, polled every 3 s |
| `POST /api/meetings/[id]/retry` | Runs a failed meeting again |
| `DELETE /api/meetings/[id]` | Deletes the meeting, its report, chat, recording and Langflow memory |
| `GET /api/meetings/[id]/audio` | Streams the recording (supports byte ranges for seeking) |
| `GET` · `POST` · `DELETE /api/meetings/[id]/chat` | Reads the chat, asks a question, clears the chat |
| `POST /api/transcribe-question` | Turns a spoken question into text |
| `GET /api/health` | Checks the database connection |

## Tech stack

| Area | Technology |
| --- | --- |
| Web app | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Base UI), lucide-react icons, react-markdown |
| Database | PostgreSQL with Prisma ORM 7 (`@prisma/adapter-pg`) |
| AI orchestration | Langflow Desktop 1.12.6 (three flows plus a custom component) |
| Speech-to-text | Groq Whisper `whisper-large-v3-turbo` (custom Langflow component) |
| Language model | Groq-hosted `openai/gpt-oss-120b` (128k-token context) through Langflow's OpenAI Compatible provider, temperature 0.1; any current Groq production chat model also works |
| Spoken answers | Browser Web Speech API (`speechSynthesis`); voice questions use `MediaRecorder` |
| Validation | Zod (report JSON) and hand-written server checks (uploads, ids, chat text) |
| Tests | Vitest (no Langflow or database needed) |

## Setup on Windows, from zero

All commands are for **PowerShell**, run from the project folder unless noted otherwise.

### Prerequisites

| Install | Notes |
| --- | --- |
| [Node.js](https://nodejs.org) **24 LTS** (or 22.12+) | Check with `node -v`. |
| [PostgreSQL](https://www.postgresql.org/download/windows/) 16 or newer | The installer also adds `psql` and pgAdmin. Remember the password you choose for the `postgres` user. |
| [Langflow Desktop](https://www.langflow.org/desktop) **1.12.6** | The steps below were checked against this version. Other versions may name things slightly differently. |
| A [Groq](https://console.groq.com) account | Create an API key at https://console.groq.com/keys. The free tier is enough for a demo. |
| Chrome or Edge | Recommended for the microphone and for the best voices. |

### 1. Install the app's packages

```powershell
cd C:\path\to\meetwise
npm install
```

`npm install` also generates the Prisma client (the `postinstall` script runs `prisma generate`).

### 2. Create the two databases

MeetWise keeps its data in `meeting_app`, and Langflow keeps its flows, chat memory and settings in `langflow`. Both run on the same PostgreSQL server. Change `17` below to your PostgreSQL version; `psql` asks for the `postgres` password.

```powershell
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
& $psql -U postgres -c "CREATE DATABASE meeting_app;"
& $psql -U postgres -c "CREATE DATABASE langflow;"
```

You can also create them in pgAdmin: right-click **Databases → Create → Database**.

### 3. Point Langflow Desktop at the `langflow` database

Out of the box, Langflow Desktop keeps its data in a SQLite file. Version 1.12.6 also does not ship the PostgreSQL driver, so you need to add the driver as well as `LANGFLOW_DATABASE_URL`. Both files live in Langflow Desktop's data folder. Notepad offers to create a file that does not exist yet.

1. Add the PostgreSQL driver. Open the requirements file:

   ```powershell
   notepad "$env:APPDATA\com.LangflowDesktop\data\requirements.txt"
   ```

   Then add this line and save:

   ```text
   psycopg[binary]==3.3.6
   ```

2. Set the database URL. Open the `.env` file:

   ```powershell
   notepad "$env:APPDATA\com.LangflowDesktop\data\.env"
   ```

   Then add this line (keep any lines already there) and save:

   ```text
   LANGFLOW_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/langflow
   ```

   If your password contains special characters, URL-encode them: `@` becomes `%40`, `#` becomes `%23`, `/` becomes `%2F`. The same rule applies to `DATABASE_URL` in step 8.

3. **Quit Langflow Desktop completely** (right-click its icon in the taskbar's notification area → Quit), then start it again. The first start takes longer while it installs the driver and creates its tables. To confirm it worked, list the tables, which should include `flow`, `message`, `variable` and `apikey`:

   ```powershell
   & $psql -U postgres -d langflow -c "\dt"
   ```

A new database means a fresh, empty Langflow, which is why the next steps add the keys and flows. Anything you built earlier stays untouched in the old SQLite file. If Langflow does not start, check `%LOCALAPPDATA%\com.LangflowDesktop\logs\langflow.log`. Removing the `LANGFLOW_DATABASE_URL` line switches Langflow back to SQLite, and MeetWise works the same either way.

### 4. Set Langflow's global variables and model provider

Do this **before** importing the flows, because the flows refer to these variables by name.

1. **Groq key for Whisper:** **Settings → Global Variables → Add New**. Set **Type** to `Credential`, **Name** to `GROQ_API_KEY`, and **Value** to your Groq key. Leave **Apply To Fields** empty.
2. **Language model:** **Settings → Model Providers → OpenAI Compatible**. Set **Base URL** to `https://api.groq.com/openai/v1` and **API Key** to your Groq key, then save. Langflow stores these as the global variables `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_API_KEY`.
   Use OpenAI Compatible rather than Langflow's built-in Groq provider: the built-in one needs the `langchain-groq` package, which Langflow Desktop does not include, so it fails when the flow runs.
3. **A Langflow API key for the app:** **Settings → Langflow API Keys → Create API Key**. Copy it straight away (Langflow shows it only once); it goes into `LANGFLOW_API_KEY` in step 8. Create it as the same Langflow user that owns the flows: Langflow refuses tweaks from other users and answers them with HTTP 404.

### 5. Import the three flows

On Langflow's home page, upload these files (use the upload/import button, or drag the files onto the page):

| File | Flow | Shape |
| --- | --- | --- |
| `langflow/flows/transcribe.json` | Transcribe | Groq Whisper Transcriber → **Transcript Output** |
| `langflow/flows/report.json` | Report | Transcript Input → Report Prompt → Language Model → **Report Output** |
| `langflow/flows/meeting-qa.json` | Meeting Q&A | Chat Input + Message History → Meeting Q&A Prompt → Language Model → **Answer Output** |

After importing, open each flow and check:

- **Report** and **Meeting Q&A:** the **Language Model** node uses `openai/gpt-oss-120b` under **OpenAI Compatible**, with Temperature 0.1 and Stream off. Pick the model again if the field is empty. Any current Groq production chat model also works.
- **Transcribe:** the **Groq API Key** field of Groq Whisper Transcriber shows `GROQ_API_KEY`. If it doesn't, click the globe icon in the field and choose it. Never paste the key itself.
- Don't rename the output nodes. The app finds the results by the names **Transcript Output**, **Report Output** and **Answer Output**.

The exported files contain no API keys. Keys are stored only in Langflow's global variables.

### 6. The custom Whisper component and uploading audio into Langflow

The Transcribe flow uses a custom component, **Groq Whisper Transcriber** (`langflow/components/groq_whisper.py`). It sends the audio to Groq's transcription API and returns clear error messages such as "Groq's rate limit was reached".

- **It comes with the flow:** the component's code is saved inside `transcribe.json`, so importing the flow adds it.
- **To add it by hand** (if the node shows a code error, or you build the flow yourself): click **New Custom Component** at the bottom of the Components sidebar, open the node's **Code** button, replace everything with the contents of `groq_whisper.py`, and click **Check & Save**. The node becomes Groq Whisper Transcriber, with the fields Groq API Key, Audio File, Model and Language Code. Keep the model as `whisper-large-v3-turbo`, and leave Language Code empty to auto-detect, or set it (for example `en`) for better accuracy.
- **Test it in Langflow:** click the node's **Audio File** field and upload a short recording; this copies the file into Langflow's own storage. Then press ▶ on **Transcript Output** and open its output to read the transcript. The test file can stay in the flow, because the app replaces it on every run.
- **How the app sends audio:** Langflow only reads files inside its own storage, because `LANGFLOW_RESTRICT_LOCAL_FILE_ACCESS` is on by default. For every recording, the app therefore:
  1. uploads the file to `POST /api/v1/files/upload/{flow id}`;
  2. passes the returned path to the component's `audio_file` field as a tweak;
  3. deletes the copy afterwards.

### 7. Copy the flow and component IDs

For each flow, open it and click **Share → API access**:

- **Flow ID:** the code sample calls `…/api/v1/run/<flow-id>`; copy the UUID after `/run/`. The part before `/api/` is your `LANGFLOW_BASE_URL` (usually `http://localhost:7860`). If you see a name instead of a UUID, clear the flow's custom endpoint name in its settings, because the file-upload route needs the UUID.
- **Component IDs:** click **Input Schema** and switch on the fields the app sets. The `tweaks` block in the code sample then shows the component ID as its key. Copy it exactly, including any space.
  - **Transcribe:** switch on **Audio File** on Groq Whisper Transcriber. The ID looks like `CustomComponent-21n2C`.
  - **Meeting Q&A:** switch on **transcript** and **summary** on Meeting Q&A Prompt. The ID looks like `Prompt Template-9inb1`.
- The **Report** flow needs only its flow ID.

**The `session_id` requirement (Q&A flow):**

- **Chat Input** and **Answer Output** store every question and answer, and **Message History** reads back the last 10 messages of the same session.
- The app sends the **meeting id as `session_id`** on every Q&A request, so each meeting has its own memory. Leave every **Session ID** field in the flow empty: a value typed there would make all meetings share one history.
- Keep **transcript** and **summary** on the prompt **unconnected**, because Langflow ignores the app's values for a field that has an incoming connection.
- The app checks both IDs on the first request, and explains what to fix if an ID is wrong or a field is connected.

### 8. Fill in `.env.local`

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://postgres:YOUR_PASSWORD@localhost:5432/meeting_app?schema=public` |
| `LANGFLOW_BASE_URL` | Langflow's address, without a trailing slash, e.g. `http://localhost:7860` |
| `LANGFLOW_API_KEY` | The Langflow API key from step 4 |
| `LANGFLOW_TRANSCRIBE_FLOW_ID` | Transcribe flow ID |
| `LANGFLOW_REPORT_FLOW_ID` | Report flow ID |
| `LANGFLOW_QA_FLOW_ID` | Meeting Q&A flow ID |
| `LANGFLOW_TRANSCRIBE_COMPONENT_ID` | Groq Whisper Transcriber component ID |
| `LANGFLOW_QA_PROMPT_COMPONENT_ID` | Meeting Q&A Prompt component ID |
| `MAX_UPLOAD_MB` | Upload limit in MB. Keep it at 25 or lower, which is Groq's file limit on the free tier. |

`.env.local` is git-ignored and is read only on the server. Restart `npm run dev` after every change to it.

### 9. Create the tables, add sample data and run

```powershell
npx prisma migrate deploy   # creates the tables in meeting_app
npm run db:seed             # optional: a sample meeting "Weekly product sync"
npm run dev                 # http://localhost:3000
```

- Open http://localhost:3000/api/health. It should show `{"ok":true,"db":"connected",...}`.
- To test the three flows end to end without the database, run `npm run test:langflow -- "C:\path\to\meeting.m4a"`. It transcribes the file, generates and validates a report, and asks one question the meeting answers and one it doesn't.
- The seeded sample meeting has a report and chat but no audio file, so its player says the recording is missing. That is expected.

### Checks

```powershell
npm test          # unit and API route tests (Vitest), no Langflow or database needed
npm run lint
npm run build
```

The tests cover report validation, upload and question validation, the Markdown-to-speech cleaner, Langflow error messages, file-path safety, and the chat, meeting and voice-question API routes, with Prisma and Langflow mocked. Use `npm run test:watch` while editing.

## How to use

1. **Upload:** open **Upload**, choose a recording, optionally type a title, and click **Upload**. The card shows each step. When it says ready, click **Open the report**. If a step fails, the message says why; click **Retry**. You can also leave the page, because processing continues on the server.
2. **Read the report:** **Meetings** lists every meeting with its status and numbers of tasks, decisions and risks. Open one to play the recording and read the report. The **Transcript** tab has a search box: Enter and Shift+Enter jump between matches.
3. **Chat:** type a question in the panel on the right and press Enter (Shift+Enter starts a new line), or click a suggested question. Follow-ups such as "who owns that?" work. If an answer fails, click **Retry**; **Clear** deletes the chat.
4. **Ask by voice:** click the mic, allow microphone access the first time, speak (up to 30 seconds), and click the mic again to stop. The question is transcribed and sent. **Escape** cancels a recording. Tick **Review before sending** to edit the text first. The microphone only works on `http://localhost` or `https://`.
5. **Hear the answers:** answers to spoken questions are read aloud automatically. Click the speaker button on any answer to hear it, or to stop it. The gear icon sets the voice and speed, plays a sample, and turns automatic reading on or off for spoken and typed questions.

## Project structure

| Folder | Contents |
| --- | --- |
| `src/app/` | Pages (`/`, `/upload`, `/meetings`, `/meetings/[id]`), loading/error states, and API routes in `src/app/api/` |
| `src/components/` | Feature components (upload form, report, transcript viewer, chat, mic and speaker buttons); shadcn primitives in `src/components/ui/` |
| `src/hooks/` | Client hooks: status polling and retry, chat state, voice recording, speech and its settings |
| `src/lib/` | Server helpers (Prisma client, Langflow client, validation, storage, processing pipeline, report schema) and browser-safe helpers (speech text, API client, formatting) |
| `src/types/` | Types shared by the API and the UI |
| `src/generated/` | Prisma client, generated by `prisma generate` (git-ignored) |
| `prisma/` | Database schema, migrations and the seed script |
| `langflow/` | Flow exports (`flows/`), the custom Whisper component (`components/`), the prompts (`prompts/`) and the build guide `FLOWS.md` |
| `scripts/` | `test-langflow.ts`, the end-to-end check of the three flows |
| `tests/` | Vitest tests: `tests/lib/` for helpers, `tests/api/` for route handlers |
| `storage/uploads/` | Uploaded recordings (git-ignored, never served directly); `tmp/` holds spoken questions while they are transcribed |

## Known limitations

- **Single user, no login.** Anyone who can open the app can see, chat with and delete every meeting, so keep it on `localhost`.
- **Background processing runs inside the web server.** If the server stops during processing, that meeting is marked failed (after 20 minutes) and needs **Retry**. Many uploads at once all run at the same time. A production version would use a job queue with workers.
- **Groq free-tier limits.** Requests and tokens per minute and per day are capped, and audio files are capped at 25 MB. Long meetings or rapid questions can fail with "rate limit" or "request too large"; wait a minute, or use a paid plan or a model with higher limits. For very long transcripts, the chat retries once with a shorter excerpt.
- **Whisper accuracy.** Strong accents, cross-talk, background noise, people's names and jargon can be transcribed wrongly, and every later step relies on the transcript. Whisper does not label speakers, so "who said what" is only as good as the names spoken in the meeting.
- **Very long meetings.** Beyond about an hour of talk, each question sends only the passages that best match it, plus the summary. An answer can therefore miss something said elsewhere.
- **AI output can still be wrong.** The report and answers are grounded in the transcript, but check anything important against the transcript or the recording.
- **Browser voice quality varies.** The voices available differ by browser and operating system. The natural-sounding ones (Edge's "Natural" voices, Chrome's "Google" voices) are online voices that **need an internet connection**; offline, the browser falls back to more robotic system voices. Some browsers block automatic reading until you have clicked the page; the speaker button then offers to read it.
- **Local storage only.** Recordings stay on this computer's disk without encryption, and there is no automatic clean-up.

## Future work

- Sign-in, with meetings that belong to a user or team
- A durable job queue (for example pg-boss on the existing PostgreSQL) with automatic retries and a concurrency limit
- Speaker labels (diarization) and timestamps, so answers can link to the exact moment in the recording
- Answers that stream in word by word, with citations of the transcript lines they used
- Search across all meetings, and questions that span several meetings
- Exporting the report (PDF, Markdown) and sending tasks to tools such as calendars or issue trackers
- End-to-end browser tests (Playwright) and a one-command setup (Docker Compose for PostgreSQL and Langflow)

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| "Cannot reach Langflow at …" | Langflow Desktop is running, and `LANGFLOW_BASE_URL` matches the address in its API access panel. |
| "Langflow rejected the API key" or "could not find the flow" (404) | `LANGFLOW_API_KEY` was created as the user who owns the flows, and the flow IDs are current. |
| "Component … has no field" or "has an incoming connection" | Copy the component ID again (step 7), and disconnect the Q&A prompt's transcript and summary fields. |
| "Groq rejected the API key" | The `GROQ_API_KEY` global variable, and the OpenAI Compatible provider key, in Langflow. |
| Error mentioning `langchain-groq` | The Language Model uses the built-in Groq provider. Pick the model under OpenAI Compatible instead. |
| "Cannot reach the database" / `/api/health` fails | PostgreSQL is running and `DATABASE_URL` is correct. Restart `npm run dev` after editing `.env.local`. |
| Microphone blocked | Allow it with the icon in the address bar. On Windows, also check Settings → Privacy & security → Microphone. |
| npm prints `install-scripts` warnings | npm 11 only runs dependency install scripts you approve. If a Prisma command reports a missing engine, run `npm install-scripts approve @prisma/engines prisma` and then `npm install`. |

More detail on building and checking each flow is in [`langflow/FLOWS.md`](langflow/FLOWS.md).
