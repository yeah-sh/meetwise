// Turns a chat answer (Markdown written by the model) into short plain-text pieces for the browser to
// read aloud (useSpeech). The answer is parsed with the same CommonMark parser react-markdown uses for
// the bubble, so what is heard matches what is shown: emphasis, headings and code lose their *, # and
// backticks, links are read by their text (a URL by its site name), and images are skipped. Each block
// (paragraph, heading, list item) is split into sentences, and an over-long sentence is cut at a comma
// or a space, because Chrome stops reading a long single utterance partway through.
import { fromMarkdown } from "mdast-util-from-markdown";

type Root = ReturnType<typeof fromMarkdown>;
type MarkdownNode = Root | Root["children"][number];

// About 10 seconds of speech at 1× (13 at 0.75×), under the roughly 15 seconds after which Chrome's
// online voices go quiet in the middle of an utterance.
const MAX_PIECE_CHARS = 160;

// Knows that "2.5" or "3 p.m. on" are not sentence ends; browsers without it split after . ! ? and …
const sentenceSegmenter =
  typeof Intl.Segmenter === "function" ? new Intl.Segmenter("en", { granularity: "sentence" }) : null;

export function speechPieces(markdown: string): string[] {
  const blocks: string[] = [];
  collectBlocks(fromMarkdown(markdown), blocks);
  return blocks.map(speakable).filter(Boolean).flatMap(sentences).flatMap(cutLong);
}

function childrenOf(node: MarkdownNode): MarkdownNode[] {
  return "children" in node ? node.children : [];
}

// The text of each paragraph, heading and code block, in reading order. Lists and block quotes are
// walked into, so every list item becomes its own block.
function collectBlocks(node: MarkdownNode, blocks: string[]) {
  if (node.type === "paragraph" || node.type === "heading") blocks.push(inlineText(node));
  else if (node.type === "code") blocks.push(node.value);
  else if (node.type === "html") blocks.push(withoutTags(node.value));
  else childrenOf(node).forEach((child) => collectBlocks(child, blocks));
}

// The words of a paragraph or heading. Emphasis, inline code and links keep only their text; images
// are left out, as the bubble does not show them either.
function inlineText(node: MarkdownNode): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
      return node.value;
    case "html":
      return withoutTags(node.value);
    case "break":
      return " ";
    case "image":
    case "imageReference":
      return "";
    default:
      return childrenOf(node).map(inlineText).join("");
  }
}

function withoutTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

// Rewrites what a voice would read out as symbols. A quoted transcript line loses its quotation marks
// and gets a short pause in front, so `she said "we ship on Friday"` is read the way a person says it.
function speakable(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>"]*[^\s<>".,;:!?)'\]]/gi, siteName)
    .replace(/\be\.g\./gi, "for example")
    .replace(/\bi\.e\./gi, "that is")
    .replace(/#(?=\d)/g, "number ")
    .replace(/([\p{L}\p{N}])\s+["“„«](?=\S)/gu, "$1, ")
    .replace(/["“”„«»]/g, "")
    .replace(/[[\]]/g, "") // "[…]" marking words left out of a quote reads as a pause
    .replace(/[*_~`#|]+|-{2,}|={2,}/g, " ") // Markdown symbols the parser left as text, e.g. a table
    .replace(/[\p{Extended_Pictographic}‍️]/gu, "") // emoji would be read out by name
    .replace(/\s+/g, " ")
    .trim();
}

// "https://www.example.com/a/b" -> "example.com"
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "a link";
  }
}

function sentences(text: string): string[] {
  const parts = sentenceSegmenter
    ? Array.from(sentenceSegmenter.segment(text), (part) => part.segment)
    : (text.match(/[^.!?…。！？]+(?:[.!?…。！？]+|$)/g) ?? [text]);
  return parts.map((part) => part.trim()).filter(Boolean);
}

// A sentence longer than MAX_PIECE_CHARS is cut after its last comma, semicolon, colon or dash that
// leaves a reasonable first part, or else at a space.
function cutLong(sentence: string): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > MAX_PIECE_CHARS) {
    const head = rest.slice(0, MAX_PIECE_CHARS);
    let cut = -1;
    for (const match of head.matchAll(/[,;:–—]\s/g)) cut = match.index + 1;
    if (cut < MAX_PIECE_CHARS / 3) cut = head.lastIndexOf(" ");
    if (cut <= 0) cut = MAX_PIECE_CHARS; // a single very long word
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  pieces.push(rest);
  return pieces;
}
