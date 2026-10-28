"use client";

// The full transcript in a scrollable panel, with a search box that highlights every match.
// Enter / Shift+Enter (or the arrow buttons) step through the matches and scroll to the current one.
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Shorter queries match almost everywhere in a long transcript, which helps nobody.
const MIN_QUERY_LENGTH = 2;

export function TranscriptViewer({ transcript }: { transcript: string }) {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  // Highlighting a long transcript can take a moment; the deferred value keeps typing smooth.
  const search = useDeferredValue(query.trim());
  const panelRef = useRef<HTMLDivElement>(null);

  // split() with a capturing group keeps the matches: even indexes are plain text, odd ones are matches.
  const parts = useMemo(
    () => (search.length >= MIN_QUERY_LENGTH ? transcript.split(new RegExp(`(${escapeRegExp(search)})`, "gi")) : [transcript]),
    [transcript, search],
  );
  const matchCount = (parts.length - 1) / 2;
  const active = matchCount > 0 ? Math.min(current, matchCount - 1) : -1;
  const wordCount = useMemo(() => transcript.split(/\s+/).filter(Boolean).length, [transcript]);

  // Scroll only the panel (not the whole page) so the current match sits in its middle.
  useEffect(() => {
    const panel = panelRef.current;
    const mark = panel?.querySelector<HTMLElement>(`[data-match="${active}"]`);
    if (!panel || !mark) return;
    panel.scrollTo({ top: mark.offsetTop - panel.clientHeight / 2 + mark.offsetHeight / 2, behavior: "smooth" });
  }, [active, parts]);

  function step(by: number) {
    if (matchCount === 0) return;
    setCurrent((active + by + matchCount) % matchCount);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  }

  const searching = search.length >= MIN_QUERY_LENGTH;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrent(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search the transcript"
            aria-label="Search the transcript"
            className="pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <p aria-live="polite" className="min-w-24 text-sm text-muted-foreground tabular-nums sm:text-right">
            {!query.trim()
              ? `${wordCount.toLocaleString("en-GB")} words`
              : !searching
                ? `Type ${MIN_QUERY_LENGTH}+ letters`
                : matchCount === 0
                  ? "No matches"
                  : `${active + 1} of ${matchCount}`}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => step(-1)} disabled={matchCount === 0} aria-label="Previous match">
              <ChevronUp />
            </Button>
            <Button variant="outline" size="icon" onClick={() => step(1)} disabled={matchCount === 0} aria-label="Next match">
              <ChevronDown />
            </Button>
          </div>
        </div>
      </div>

      {/* relative: makes the panel the offsetParent of the marks, for the scroll maths above. */}
      <div
        ref={panelRef}
        tabIndex={0}
        aria-label="Transcript"
        className="relative max-h-[65vh] overflow-y-auto rounded-xl bg-muted/40 p-4 text-sm leading-7 break-words whitespace-pre-wrap ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        {parts.map((part, index) => {
          if (index % 2 === 0) return part;
          const matchIndex = (index - 1) / 2;
          return (
            <mark
              key={index}
              data-match={matchIndex}
              className={cn(
                // The negative margin cancels the padding, so highlighting never moves the text.
                "-mx-0.5 rounded-sm px-0.5 text-foreground",
                matchIndex === active ? "bg-orange-400 text-black" : "bg-yellow-200 dark:bg-yellow-400/35",
              )}
            >
              {part}
            </mark>
          );
        })}
      </div>
    </div>
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
