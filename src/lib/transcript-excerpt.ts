// Keeps the transcript sent with each chat question within the model's limits.
//
// Every question sends the Q&A flow the prompt's rules (~700 tokens), the summary, the last 10 chat
// messages Langflow remembers, the question and the transcript, which is by far the biggest part.
// llama-3.3-70b-versatile reads up to 128k tokens, but because the transcript goes out again with
// every question, its size also decides per-minute token limits (Groq's free tier allows far fewer
// tokens per minute than the model can read), speed and cost, and models find facts less reliably in
// very long prompts. So:
//
// 1. Up to TRANSCRIPT_BUDGET_CHARS (60,000 characters, about 15,000 tokens at ~4 characters per
//    token, roughly an hour of talk) the transcript is sent whole. That covers most meetings, and the
//    report flow has already handled the same transcript.
// 2. A longer transcript is cut into passages of about PASSAGE_CHARS at sentence ends. Passages are
//    ranked by the words they share with the question (and the previous question, so a follow-up
//    like "who owns that?" still finds its topic), with rare words counting more than common ones.
//    The best passages are kept until the budget is full, leftover room goes to passages spread
//    evenly over the meeting, and they are sent in their original order with "[…]" where text was
//    left out and a note saying it is an excerpt. The summary is still sent in full, so the model
//    keeps an outline of the whole meeting. This is plain keyword matching: no extra AI call.
// 3. If the provider still refuses the request as too large, answerQuestion (chat.ts) asks once more
//    with SMALL_TRANSCRIPT_BUDGET_CHARS (16,000 characters, about 4,000 tokens).
import "server-only";

export const TRANSCRIPT_BUDGET_CHARS = 60_000;
export const SMALL_TRANSCRIPT_BUDGET_CHARS = 16_000;

// About a minute and a half of speech: small enough to pick precisely, big enough to keep context.
const PASSAGE_CHARS = 1_500;
const GAP_MARKER = "[…]";
// Room for the line break and a possible gap marker that come with each passage.
const PASSAGE_OVERHEAD = GAP_MARKER.length + 2;

const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const wordSegmenter = new Intl.Segmenter("en", { granularity: "word" });

// Words common in questions that say nothing about where the answer is.
const STOP_WORDS = new Set(
  (
    "the and but for not are was were been being has have had does did doing what which who whom whose " +
    "when where why how this that these those there here then than with without from into about over " +
    "after before also just only very any all some each our ours your yours you they them their she her " +
    "his him its it's can could would should will shall may might must tell said say says meeting discussed"
  ).split(" "),
);

// Returns the transcript itself when it fits in maxChars; otherwise an excerpt of at most maxChars
// made of the passages that best match searchText (the question, plus the previous one).
export function fitTranscript(transcript: string, searchText: string, maxChars: number): string {
  if (transcript.length <= maxChars) return transcript;

  const note =
    `[Excerpt: the full transcript (${transcript.length.toLocaleString("en-GB")} characters) is too long to send, ` +
    `so these are the passages that best match the question, in their original order. "${GAP_MARKER}" marks ` +
    `text that was left out; something missing here may be in those parts.]\n\n`;
  const passages = splitIntoPassages(transcript);
  const chosen = choosePassages(passages, keywords(searchText), maxChars - note.length);

  const parts: string[] = [];
  let expected = 0; // the index that would follow the previous passage without a gap
  for (const index of chosen) {
    if (index !== expected) parts.push(GAP_MARKER);
    parts.push(passages[index]);
    expected = index + 1;
  }
  if (expected < passages.length) parts.push(GAP_MARKER);
  return note + parts.join("\n");
}

// Indexes of the passages to send, in transcript order, fitting within budget characters.
function choosePassages(passages: string[], searchWords: Set<string>, budget: number): number[] {
  const passageWords = passages.map(keywords);

  // A word found in few passages points at the answer; one found in every passage scores 0.
  const weights = new Map<string, number>();
  for (const word of searchWords) {
    const found = passageWords.filter((words) => words.has(word)).length;
    if (found > 0) weights.set(word, Math.log(passages.length / found));
  }
  const scores = passageWords.map((words) =>
    [...weights].reduce((sum, [word, weight]) => (words.has(word) ? sum + weight : sum), 0),
  );

  const chosen = new Set<number>();
  let used = 0;
  const take = (index: number) => {
    const cost = passages[index].length + PASSAGE_OVERHEAD;
    if (used + cost > budget) return;
    chosen.add(index);
    used += cost;
  };

  const indexes = passages.map((_, index) => index);
  indexes
    .filter((index) => scores[index] > 0)
    .sort((a, b) => scores[b] - scores[a])
    .forEach(take);

  // Fill the remaining room with passages spread evenly over the meeting, so a question without
  // telling words (e.g. "anything else?") still sees all parts of it.
  const unmatched = indexes.filter((index) => scores[index] === 0);
  const count = Math.min(unmatched.length, Math.floor((budget - used) / (PASSAGE_CHARS + PASSAGE_OVERHEAD)));
  const step = unmatched.length / count;
  for (let i = 0; i < count; i++) take(unmatched[Math.floor((i + 0.5) * step)]);

  return [...chosen].sort((a, b) => a - b);
}

// Cuts the transcript into trimmed passages of up to PASSAGE_CHARS, at sentence ends where possible.
function splitIntoPassages(transcript: string): string[] {
  const passages: string[] = [];
  let current = "";
  for (const { segment } of sentenceSegmenter.segment(transcript)) {
    for (const piece of cutLongSentence(segment)) {
      if (current.length + piece.length > PASSAGE_CHARS && current.trim()) {
        passages.push(current.trim());
        current = "";
      }
      current += piece;
    }
  }
  if (current.trim()) passages.push(current.trim());
  return passages;
}

// Whisper sometimes leaves long stretches unpunctuated; such a "sentence" is cut at spaces instead.
function cutLongSentence(sentence: string): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > PASSAGE_CHARS) {
    const space = rest.lastIndexOf(" ", PASSAGE_CHARS);
    const end = space > 0 ? space + 1 : PASSAGE_CHARS;
    pieces.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  pieces.push(rest);
  return pieces;
}

// Lower-cased content words, with a plural "s" removed so that "tasks" matches "task".
function keywords(text: string): Set<string> {
  const words = new Set<string>();
  for (const { segment, isWordLike } of wordSegmenter.segment(text.toLowerCase())) {
    if (!isWordLike || STOP_WORDS.has(segment)) continue;
    // Words under three letters are mostly filler; numbers such as "5" or "q3" are kept.
    if (segment.length < 3 && !/\d/.test(segment)) continue;
    words.add(segment.length > 3 && segment.endsWith("s") && !segment.endsWith("ss") ? segment.slice(0, -1) : segment);
  }
  return words;
}
