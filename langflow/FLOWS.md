# Building the MeetWise flows in Langflow Desktop

Step-by-step instructions for building the three flows MeetWise calls. Written for and checked against **Langflow Desktop 1.12.6** (the version installed on this machine). Other versions may label things a little differently.

| Flow | The app sends | Output component | The app gets back |
| --- | --- | --- | --- |
| MeetWise Transcribe | an uploaded audio file, as a tweak on the Whisper component | **Transcript Output** (Text Output) | the transcript text |
| MeetWise Report | the transcript, as the flow's text input | **Report Output** (Text Output) | the report as JSON text |
| MeetWise Meeting Q&A | the question as chat input, the transcript and summary as tweaks, and the meeting id as `session_id` | **Answer Output** (Chat Output) | a short answer |

By the end you will have these values for `.env.local`:

| Value | Variable | Where you find it |
| --- | --- | --- |
| Langflow address, e.g. `http://localhost:7860` | `LANGFLOW_BASE_URL` | API access panel (step 5) |
| Langflow API key | `LANGFLOW_API_KEY` | step 1.4 |
| Transcribe flow ID | `LANGFLOW_TRANSCRIBE_FLOW_ID` | step 5 |
| Groq Whisper Transcriber component ID | `LANGFLOW_TRANSCRIBE_COMPONENT_ID` | step 5 |
| Report flow ID | `LANGFLOW_REPORT_FLOW_ID` | step 5 |
| Q&A flow ID | `LANGFLOW_QA_FLOW_ID` | step 5 |
| Meeting Q&A Prompt component ID | `LANGFLOW_QA_PROMPT_COMPONENT_ID` | step 5 |

Restart `npm run dev` after editing `.env.local`.

---

## 1. One-time setup

### 1.1 Store the Groq API key as a global variable

Global variables keep secrets inside Langflow instead of inside flows or the app.

1. Open **Settings → Global Variables → Add New**.
2. **Type:** `Credential`. **Name:** `GROQ_API_KEY`. **Value:** your Groq key from https://console.groq.com/keys.
3. Leave **Apply To Fields** empty and save.

### 1.2 Connect the language model used by Report and Q&A

Langflow's built-in Groq model needs the `langchain-groq` package, which **this Langflow Desktop does not include**, so picking a Groq model there fails at run time. Groq also offers an OpenAI-compatible API, and Langflow ships an **OpenAI Compatible** provider that works with it without installing anything:

1. Open **Settings → Model Providers → OpenAI Compatible**.
2. **Base URL:** `https://api.groq.com/openai/v1`
3. **API Key:** your Groq key. Save. Langflow stores these as the global variables `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_API_KEY`.

Model to use in both flows: **`openai/gpt-oss-120b`** (128k-token context), with **Temperature** `0.1`. Any current Groq production chat model also works (see https://console.groq.com/docs/models); pick it under **OpenAI Compatible** in both flows. The flows stay the same.

> **Groq free tier.** Groq limits tokens per minute for each model. A one-hour meeting produces a transcript of roughly 10,000 to 15,000 tokens, and the Q&A flow sends the whole transcript with every question. Long meetings can fail with a "request too large" or rate-limit (HTTP 413/429) error. Check your limits at https://console.groq.com/settings/limits. If you hit them, choose a model with a higher limit or upgrade your Groq plan. You can also use any other provider listed under Model Providers; the flows stay the same.

### 1.3 Note the Langflow address

The code samples in each flow's API access panel (step 5) start with Langflow's address, for example `http://localhost:7860`. Put the address into `LANGFLOW_BASE_URL`, without a trailing slash or `/api`.

### 1.4 Create a Langflow API key for the app

1. Open **Settings → Langflow API Keys → Create API Key**.
2. Copy the key immediately, because Langflow shows it only once. Put it into `LANGFLOW_API_KEY`.

Create it in the same Langflow you build the flows in. Langflow accepts tweaks only from the flows' owner, and shows full error messages only to the owner.

---

## 2. Flow 1: MeetWise Transcribe

Shape: **Groq Whisper Transcriber → Transcript Output**

1. **New Flow → Blank Flow.** Rename it `MeetWise Transcribe` by clicking its name at the top.
2. **Add the custom component.** At the bottom of the Components sidebar, click **New Custom Component**. A "Custom Component" node appears.
3. Open the node's code editor (the **Code** button in the node's toolbar). Select all, delete, and paste the whole of [`components/groq_whisper.py`](components/groq_whisper.py). Click **Check & Save**. The node becomes **Groq Whisper Transcriber** with the fields Groq API Key, Audio File, Model and Language Code.
4. **Groq API Key:** click the globe icon in the field and choose `GROQ_API_KEY`. Never paste the key itself.
5. **Model:** leave it as `whisper-large-v3-turbo`. **Language Code:** leave it empty to auto-detect. If every meeting is in one language, entering its code (for example `en`) makes transcription faster and more accurate.
6. **Add a Text Output** (search the sidebar for "Text Output"). Connect **Groq Whisper Transcriber → Transcript** to **Text Output → Inputs**.
7. **Rename** the Text Output to `Transcript Output` by double-clicking its title. The app finds the result by this name.
8. **Test it.** Click **Audio File** and upload a short recording. Click the run (▶) button on **Transcript Output**, then open that node's output to read the transcript. If something is wrong, the error appears on the Whisper node. The test file can stay in the flow, because the app replaces it on every run.

The node ID begins with `CustomComponent-` because of how the node was created. That is expected.

### How the app will call it

The app cannot pass a path inside `storage/uploads`, because Langflow refuses to read files outside its own storage (`LANGFLOW_RESTRICT_LOCAL_FILE_ACCESS` is on by default). The app therefore copies the audio into Langflow first:

1. `POST {LANGFLOW_BASE_URL}/api/v1/files/upload/{LANGFLOW_TRANSCRIBE_FLOW_ID}` as multipart form data, with the audio in the `file` field. The response contains `"file_path": "<flow-id>/<timestamp>_<name>"`.
2. `POST {LANGFLOW_BASE_URL}/api/v1/run/{LANGFLOW_TRANSCRIBE_FLOW_ID}` with:
   ```json
   {
     "output_type": "text",
     "tweaks": { "<LANGFLOW_TRANSCRIBE_COMPONENT_ID>": { "audio_file": "<file_path from step 1>" } }
   }
   ```
3. Afterwards it deletes the copy: `DELETE /api/v1/files/delete/{flow_id}/{file name part of file_path}`.

If the component fails, `/run` responds with HTTP 500 and a message such as `Error building Component Groq Whisper Transcriber: Groq rejected the API key (HTTP 401)...`. The app can store that message in `Meeting.errorMessage`.

---

## 3. Flow 2: MeetWise Report

Shape: **Transcript Input → Report Prompt → Language Model → Report Output**

1. **New Flow → Blank Flow**, named `MeetWise Report`.
2. **Add a Text Input** and rename it `Transcript Input`. The app sends the transcript as the flow's input, and Langflow delivers it here.
3. **Add a Prompt Template** and rename it `Report Prompt`. Click its **Template** field, paste the whole of [`prompts/report_prompt.md`](prompts/report_prompt.md), then **Check & Save**. One variable field appears: **transcript**.
   - Leave **Use Double Brackets** (under the node's controls) **off**.
   - The JSON example in the prompt uses doubled braces `{{ }}` on purpose. In this mode, single braces mark variables such as `{transcript}`, and doubled braces mean a literal brace. Langflow sends the model single braces. Don't "fix" them.
4. Connect **Transcript Input → Output Text** to **Report Prompt → transcript**.
5. **Add a Language Model.** Pick `openai/gpt-oss-120b` under **OpenAI Compatible**. In its controls, set **Temperature** to `0.1` and leave **Stream** off. Connect **Report Prompt → Prompt** to **Language Model → Input**, and leave **System Message** empty.
6. **Add a Text Output** and rename it `Report Output`. Connect **Language Model → Model Response** to **Report Output → Inputs**.
7. **Test it.** Paste a few lines of sample transcript into **Transcript Input**, run **Report Output**, and check that the output is a single JSON object.

### How the app will call it

```json
POST /api/v1/run/{LANGFLOW_REPORT_FLOW_ID}
{ "input_value": "<transcript>", "input_type": "text", "output_type": "text" }
```

No component ID is needed. The app should still parse the JSON defensively, for example by removing a stray ```` ``` ```` fence if the model adds one.

---

## 4. Flow 3: MeetWise Meeting Q&A

Shape:

```
Chat Input ───────────────► Meeting Q&A Prompt (question)
Message History ──────────► Meeting Q&A Prompt (history)
(app tweaks) ─────────────► Meeting Q&A Prompt (transcript, summary)
Meeting Q&A Prompt ───────► Language Model (Input) ───► Answer Output
```

1. **New Flow → Blank Flow**, named `MeetWise Meeting Q&A`.
2. **Add a Chat Input.** Keep the defaults. **Store Messages** must stay on, because that is how each question is saved to memory.
3. **Add a Message History.** Set **Mode** to `Retrieve`. In its controls:
   - **Number of Messages:** `10` (the last five questions and answers, enough for follow-up questions without making the prompt too long).
   - **Order:** `Ascending`. **Sender Type:** `Machine and User`. **Template:** keep `{sender_name}: {text}`.
   - **Session ID:** leave empty (see "Chat memory" below).
4. **Add a Prompt Template** and rename it `Meeting Q&A Prompt`. Paste the whole of [`prompts/qa_prompt.md`](prompts/qa_prompt.md) into **Template**, then **Check & Save**. Four variable fields appear: **transcript**, **summary**, **history** and **question**. Leave **Use Double Brackets** off.
5. **Connect:**
   - **Chat Input → Chat Message** to **Meeting Q&A Prompt → question**
   - **Message History → Messages** to **Meeting Q&A Prompt → history**
   - Leave **transcript** and **summary** unconnected. The app fills them on every request. A field with a connection ignores tweaks, so these two must stay unconnected.
6. **Add a Language Model** with the same model. Set **Temperature** to `0.1` and leave **Stream** off. Connect **Meeting Q&A Prompt → Prompt** to **Language Model → Input**, and leave **System Message** empty.
7. **Add a Chat Output** and rename it `Answer Output`. Connect **Language Model → Model Response** to **Answer Output → Inputs**. Keep **Store Messages** on, because that is how answers are saved to memory.
8. **Test it.** Paste a short sample transcript and summary into the **transcript** and **summary** fields. Open the **Playground** and ask a question, then a follow-up such as "who is doing that?" to check that memory works. Also ask about something that is not in the sample, and check that the reply says it was not discussed. Clear or shorten the sample text afterwards if you like, because the app's tweaks replace it on every request.

### Chat memory per session

- **Chat Input** and **Answer Output** save every question and answer in Langflow's message store, tagged with the run's **session ID**. **Message History** reads back the last 10 messages for that same session ID.
- On every run, Langflow writes the request's `session_id` into every component that has a Session ID field. That is why those fields stay empty.
- **The app must send the meeting's id as `session_id` on every Q&A request.** Without it, Langflow uses the flow ID as the session ID, and every meeting would share a single history.
- Langflow always runs the Chat Input first, so the current question is already stored when Message History reads. It therefore appears as the last `User:` line of `{history}`, and the prompt tells the model to expect that.
- Stored messages are listed under **Settings → Messages**. When a meeting's chat is cleared or the meeting is deleted, the app clears its memory with `DELETE /api/v1/monitor/messages/session/{meetingId}`.

### How the app will call it

```json
POST /api/v1/run/{LANGFLOW_QA_FLOW_ID}
{
  "input_value": "<question>",
  "input_type": "chat",
  "output_type": "chat",
  "session_id": "<meeting id>",
  "tweaks": {
    "<LANGFLOW_QA_PROMPT_COMPONENT_ID>": { "transcript": "<transcript>", "summary": "<summary or empty>" }
  }
}
```

---

## 5. Find each flow ID and the component IDs

Do this for each flow:

1. Open the flow and click **Share** (top right), then **API access**.
2. **Flow ID:** the code sample calls `.../api/v1/run/<flow-id>`. The UUID after `/run/` is the flow ID, and the part before `/api/` is `LANGFLOW_BASE_URL`. If you see a name instead of a UUID, the flow has a custom endpoint name. Clear it in the flow's settings, because the file-upload route needs the UUID.
3. **Component IDs:** click **Input Schema** in the same panel and switch on the field the app will set:
   - Transcribe: **Audio File** on **Groq Whisper Transcriber**
   - Meeting Q&A: **transcript** and **summary** on **Meeting Q&A Prompt**

   The code sample then shows a `tweaks` block keyed by the component ID, for example `"CustomComponent-Ab1Cd": { "audio_file": ... }` or `"Prompt Template-Xy9Zw": { "transcript": ... }`. Copy that key exactly, including any space and the part after the dash.
4. The Report flow needs only its flow ID.

Component IDs stay the same when you edit a node, re-paste a prompt or rename the node. They change only if you delete the node and add a new one. If that happens, copy the new ID into `.env.local`.

### Reading the result

The `/run` response lists one entry per output component under `outputs[0].outputs`. Each entry has `component_display_name` ("Transcript Output", "Report Output" or "Answer Output") and `component_id`. The text is at `results.text.text` for a Text Output, and at `results.message.text` for a Chat Output. Check these paths against a real response when wiring up `src/lib/langflow.ts`.

---

## 6. Save the flows in this repo

For each flow, click **Share → Export**, leave **Save with my API keys** unticked, and save the JSON file in `langflow/flows/` (for example `langflow/flows/meetwise-transcribe.json`). This keeps the flows versioned with the app. Open each exported file before committing and make sure it contains no keys.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Groq API key is missing" or HTTP 401 | The Groq API Key field is not set to the `GROQ_API_KEY` global variable, or the key is wrong. |
| Language Model error about `langchain-groq` | A model under the built-in **Groq** provider was picked. Pick it under **OpenAI Compatible** instead (step 1.2). |
| HTTP 413 or 429 from Groq | The file is over 25 MB, or you hit the free tier's limits (see the note in step 1.2). |
| The prompt shows no `transcript` field | **Use Double Brackets** is on, or the template was not saved with **Check & Save**. |
| Answers mix up different meetings | The app is not sending `session_id`, or a Session ID field was filled in by hand. |
| Tweaks seem to be ignored | The field also has an incoming connection, or the component ID in `.env.local` is out of date. |
| HTTP 404 "Flow not found" | The flow ID is wrong, or the API key belongs to a different Langflow user from the flows' owner. Langflow answers 404 when a non-owner sends tweaks. |
