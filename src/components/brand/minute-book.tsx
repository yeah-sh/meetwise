// Line drawings of an open minute book for the empty and missing states: BlankMinuteBook (no
// meetings yet) and TornMinuteBook (the meeting cannot be found: its page has been torn out).
// Static and decorative. Lines use currentColor (set it with a text-* class); the waveform
// letterhead and the ribbon are in the brand colour. Size them with a width class, e.g. w-40.
import type { ReactNode } from "react";
import { WaveformMark } from "@/components/brand/waveform";

const LEFT_PAGE = "M80 30 Q56 20 22 25 V95 Q56 90 80 99 Z";
const RIGHT_PAGE = "M80 30 Q104 20 138 25 V95 Q104 90 80 99 Z";

export function BlankMinuteBook({ className }: { className?: string }) {
  return (
    <Book className={className}>
      <path d={RIGHT_PAGE} className="fill-card" />
      <path d="M90 40 H128 M90 50 H128 M90 60 H128 M90 70 H128 M90 80 H128" className="opacity-35" />
    </Book>
  );
}

export function TornMinuteBook({ className }: { className?: string }) {
  return (
    <Book className={className}>
      {/* Where the right page was, and the stub left at the spine. */}
      <path d={RIGHT_PAGE} strokeDasharray="3 4" className="opacity-45" />
      <path
        d="M80 30 Q83 29 86.5 28.4 L84 35 L88 41.5 L84.5 48 L88.5 55 L84 62 L88 69 L84.5 76 L88.5 83 L84.5 90 L86.5 96.6 Q83 97.6 80 99 Z"
        className="fill-card"
      />
      {/* The torn-out page drifting away. */}
      <path d="M100 13 q5 -3.5 10 -2.5 M102 23 q5 -3.5 10 -2.5" className="opacity-45" />
      <g transform="translate(118 4) rotate(14)">
        <rect width="30" height="38" rx="2.5" className="fill-card" />
        <g transform="translate(6 6)">
          <WaveformMark width={9} height={9} className="text-primary" />
        </g>
        <path d="M6 21 H24 M6 28 H20" className="opacity-35" />
      </g>
    </Book>
  );
}

// The cover, the left page with its letterhead and ruled lines, the spine and the ribbon. children
// draw the right-hand side, between the cover and the spine.
function Book({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 30 V100 Q47 94 80 104 Q113 94 146 100 V30 Z" className="fill-primary/10" />
      <path d={LEFT_PAGE} className="fill-card" />
      <g transform="translate(32 34)">
        <WaveformMark width={12} height={12} className="text-primary" />
      </g>
      <path d="M50 40 H70" />
      <path d="M32 54 H70 M32 64 H70 M32 74 H70 M32 84 H62" className="opacity-35" />
      {children}
      <path d="M80 30 V99" />
      <path d="M84 98 V112 L87.5 108.5 L91 112 V97.4" className="fill-primary/25 stroke-primary" />
    </svg>
  );
}
