"use client";

// The gear button in the chat panel's header and its popover of read-aloud settings: reading new
// answers aloud automatically (separately after spoken and typed questions), the voice and the speed,
// with a sample to hear the choice. MeetingChat only shows it where the browser can speak.
import { useId } from "react";
import { Play, Settings2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { isEnglishVoice, voiceLang, type Speech } from "@/hooks/use-speech";
import { MAX_RATE, MIN_RATE, type SpeechSettings } from "@/hooks/use-speech-settings";

const SAMPLE_ID = "voice-sample"; // speaks like a message id, so it shares the one-at-a-time rule
const SAMPLE_TEXT = "Hello! This is how answers about your meeting will sound.";

// e.g. "en-GB" -> "English (United Kingdom)", the way Windows names its voices.
const languageNames = new Intl.DisplayNames(["en"], { type: "language", languageDisplay: "standard" });
const rateFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

type ChatSettingsProps = { settings: SpeechSettings; speech: Speech };

export function ChatSettings({ settings, speech }: ChatSettingsProps) {
  const voiceId = useId();
  const speedId = useId();
  const english = speech.voices.filter(isEnglishVoice);
  const others = speech.voices.filter((voice) => !isEnglishVoice(voice));
  // A saved voice this browser does not offer (or not yet, while voices load) shows as the default,
  // which is also what useSpeech then uses.
  const voiceURI = speech.voices.some((voice) => voice.voiceURI === settings.voiceURI) ? settings.voiceURI : "";
  const playingSample = speech.speakingId === SAMPLE_ID;

  function handleOpenChange(open: boolean) {
    if (!open && playingSample) speech.stop(); // its Stop button goes away with the popover
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Chat settings" title="Chat settings" className="text-muted-foreground" />}
      >
        <Settings2 />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Spoken answers</PopoverTitle>
          <PopoverDescription>Read aloud by your browser’s own voices.</PopoverDescription>
        </PopoverHeader>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-xs font-medium text-muted-foreground">Read answers aloud automatically</legend>
          {/* Base UI's switch is labelled by the <label> around it. */}
          <Label className="justify-between font-normal">
            After spoken questions
            <Switch checked={settings.autoReadSpoken} onCheckedChange={(checked) => settings.setAutoReadSpoken(checked)} />
          </Label>
          <Label className="justify-between font-normal">
            After typed questions
            <Switch checked={settings.autoReadTyped} onCheckedChange={(checked) => settings.setAutoReadTyped(checked)} />
          </Label>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor={voiceId}>Voice</Label>
          <NativeSelect id={voiceId} value={voiceURI} onChange={(event) => settings.setVoiceURI(event.target.value)} className="w-full">
            <NativeSelectOption value="">Browser default</NativeSelectOption>
            {english.length > 0 && <NativeSelectOptGroup label="English">{english.map(voiceOption)}</NativeSelectOptGroup>}
            {others.length > 0 && <NativeSelectOptGroup label="Other languages">{others.map(voiceOption)}</NativeSelectOptGroup>}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span id={speedId} className="text-sm leading-none font-medium">
              Speed
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{rateFormat.format(settings.rate)}×</span>
          </div>
          {/* An array value: the shadcn Slider draws one thumb per entry. */}
          <Slider
            aria-labelledby={speedId}
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.05}
            value={[settings.rate]}
            onValueChange={(value) => settings.setRate(typeof value === "number" ? value : value[0])}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => (playingSample ? speech.stop() : speech.speak(SAMPLE_ID, SAMPLE_TEXT))}
        >
          {playingSample ? <Square data-icon="inline-start" /> : <Play data-icon="inline-start" />}
          {playingSample ? "Stop sample" : "Play a sample"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function voiceOption(voice: SpeechSynthesisVoice) {
  return (
    <NativeSelectOption key={voice.voiceURI} value={voice.voiceURI}>
      {voiceLabel(voice)}
    </NativeSelectOption>
  );
}

// e.g. "Microsoft Sonia Online (Natural) · English (United Kingdom)". Microsoft voices end their name
// with their language ("… - English (United Kingdom)"), which is dropped so it is not shown twice.
// Voices that need the internet are marked, unless their name already says so.
function voiceLabel(voice: SpeechSynthesisVoice): string {
  const name = voice.name.replace(/\s+-\s+[^-]+$/, "");
  const online = !voice.localService && !/online/i.test(voice.name) ? ", online" : "";
  return `${name} · ${languageName(voiceLang(voice))}${online}`;
}

function languageName(tag: string): string {
  try {
    return languageNames.of(tag) ?? tag;
  } catch {
    return tag; // not a valid language tag
  }
}
