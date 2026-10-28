"""Groq Whisper Transcriber: Langflow custom component for MeetWise's Transcribe flow.

Paste this whole file into a Custom Component in Langflow Desktop (see langflow/FLOWS.md).
Written against Langflow 1.12, where components import from the `lfx` package.
"""

import mimetypes
import re
from pathlib import Path

import httpx
from lfx.custom.custom_component.component import Component
from lfx.io import FileInput, Output, SecretStrInput, StrInput
from lfx.schema.message import Message

GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
DEFAULT_MODEL = "whisper-large-v3-turbo"
AUDIO_FILE_TYPES = ["mp3", "mp4", "m4a", "wav", "webm", "ogg", "flac"]
# Groq answers in seconds, but uploading a 25 MB file on a slow connection can take minutes.
REQUEST_TIMEOUT = httpx.Timeout(300.0, connect=15.0)


class GroqWhisperTranscriber(Component):
    display_name = "Groq Whisper Transcriber"
    description = "Transcribes an audio file to text with Groq's hosted Whisper models."
    documentation = "https://console.groq.com/docs/speech-to-text"
    icon = "Groq"
    name = "GroqWhisperTranscriber"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Groq API Key",
            info="Select the GROQ_API_KEY global variable instead of pasting the key here.",
            required=True,
        ),
        FileInput(
            name="audio_file",
            display_name="Audio File",
            file_types=AUDIO_FILE_TYPES,
            info="The recording to transcribe. MeetWise sets this on every run with an API tweak.",
            required=True,
        ),
        StrInput(
            name="model_name",
            display_name="Model",
            value=DEFAULT_MODEL,
            info="whisper-large-v3-turbo (fast) or whisper-large-v3 (slightly more accurate).",
        ),
        StrInput(
            name="language",
            display_name="Language Code",
            value="",
            info="Optional ISO-639-1 code such as 'en' or 'hi'. Leave empty to auto-detect.",
        ),
    ]

    outputs = [
        Output(display_name="Transcript", name="transcript", method="transcribe"),
    ]

    async def transcribe(self) -> Message:
        audio_path = self._resolve_audio_path()
        form = {"model": (self.model_name or "").strip() or DEFAULT_MODEL, "response_format": "json"}
        language = (self.language or "").strip().lower()
        if language:
            if not re.fullmatch(r"[a-z]{2,3}", language):
                msg = f"Language code '{language}' is not valid. Use an ISO-639-1 code such as 'en', or leave it empty."
                raise ValueError(msg)
            form["language"] = language

        mime_type = mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream"
        files = {"file": (audio_path.name, audio_path.read_bytes(), mime_type)}
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    GROQ_TRANSCRIPTIONS_URL,
                    headers={"Authorization": f"Bearer {self._read_api_key()}"},
                    data=form,
                    files=files,
                )
        except httpx.TimeoutException as e:
            msg = "Groq did not respond in time. Try again, or upload a shorter recording."
            raise RuntimeError(msg) from e
        except httpx.HTTPError as e:
            msg = f"Could not reach Groq ({type(e).__name__}: {e}). Check the internet connection and try again."
            raise RuntimeError(msg) from e

        if response.status_code != httpx.codes.OK:
            raise RuntimeError(self._describe_error(response))

        text = self._parse_transcript(response)
        if not text:
            msg = "Groq returned an empty transcript. The recording may contain no speech."
            raise ValueError(msg)
        message = Message(text=text)
        self.status = message
        return message

    def _resolve_audio_path(self) -> Path:
        value = self.audio_file
        # A FileInput can hold a list of paths; this component transcribes one file.
        if isinstance(value, list):
            value = value[0] if value else None
        if not value:
            msg = "No audio file was provided. Upload one, or pass it with an API tweak on 'audio_file'."
            raise ValueError(msg)
        path = Path(str(value))
        if not path.is_file():
            msg = f"Audio file not found: {path.name}"
            raise ValueError(msg)
        if path.suffix.lower().lstrip(".") not in AUDIO_FILE_TYPES:
            msg = f"Unsupported audio type '{path.suffix or 'none'}'. Use one of: {', '.join(AUDIO_FILE_TYPES)}."
            raise ValueError(msg)
        return path

    def _read_api_key(self) -> str:
        key = self.api_key
        # Secret inputs usually arrive as plain strings, but may be a pydantic SecretStr.
        if hasattr(key, "get_secret_value"):
            key = key.get_secret_value()
        key = (key or "").strip()
        if not key:
            msg = "Groq API key is missing. Select the GROQ_API_KEY global variable in the 'Groq API Key' field."
            raise ValueError(msg)
        return key

    @staticmethod
    def _describe_error(response: httpx.Response) -> str:
        """Build a short error for a failed Groq call. Never includes the API key."""
        status = response.status_code
        if status == httpx.codes.UNAUTHORIZED:
            # Skip Groq's own text here in case it echoes part of the key.
            return "Groq rejected the API key (HTTP 401). Check the GROQ_API_KEY global variable in Langflow."
        try:
            detail = response.json()["error"]["message"]
        except (ValueError, KeyError, TypeError):
            detail = response.text[:300]
        hints = {
            413: "The audio file is too large for Groq (the free tier accepts up to 25 MB).",
            429: "Groq's rate limit was reached. Wait a minute and try again.",
        }
        hint = hints.get(status, "Groq could not transcribe the audio.")
        return f"{hint} (HTTP {status}: {detail})"

    @staticmethod
    def _parse_transcript(response: httpx.Response) -> str:
        try:
            return str(response.json().get("text") or "").strip()
        except (ValueError, AttributeError) as e:
            msg = "Groq returned a response that was not valid JSON."
            raise RuntimeError(msg) from e
