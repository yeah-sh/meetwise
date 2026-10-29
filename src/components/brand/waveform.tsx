// The MeetWise waveform: a stylised recording drawn from a fixed set of bar heights. Waveform is the
// long version (processing steps, loading placeholders, dividers, the home page); WaveformMark is the
// logo, five bars from the middle of the same wave, few enough to stay crisp at 12-24 px.
// Decorative only: it is not the meeting's real audio. Bars are filled with currentColor, so colour it
// with a text-* class. Each bar carries --wave-i (its position), which wave-moving in globals.css
// uses to stagger the bars when they move.
import type { CSSProperties } from "react";

// Each bar's height as a share of the full height: a short phrase of speech, loudest in the middle.
const WAVE = [0.2, 0.38, 0.26, 0.56, 0.36, 0.74, 0.44, 1, 0.62, 0.86, 0.4, 0.68, 0.3, 0.5, 0.24, 0.34, 0.18];
const MARK = WAVE.slice(5, 10);

// In viewBox units: bar width, the gap between bars, and the full height.
const BAR = 3;
const GAP = 2;
const HEIGHT = 24;

type WaveformProps = {
  width: number | string;
  height: number | string;
  className?: string;
};

export function Waveform(props: WaveformProps) {
  return <Bars heights={WAVE} {...props} />;
}

export function WaveformMark(props: WaveformProps) {
  return <Bars heights={MARK} {...props} />;
}

function Bars({ heights, width, height, className }: WaveformProps & { heights: number[] }) {
  const viewWidth = heights.length * (BAR + GAP) - GAP;
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${viewWidth} ${HEIGHT}`}
      width={width}
      height={height}
      fill="currentColor"
      stroke="none" // not the stroke of a line drawing it sits in
      className={className}
    >
      {heights.map((share, index) => {
        const barHeight = share * HEIGHT;
        return (
          <rect
            key={index}
            x={index * (BAR + GAP)}
            y={(HEIGHT - barHeight) / 2}
            width={BAR}
            height={barHeight}
            rx={BAR / 2}
            style={{ "--wave-i": index } as CSSProperties}
          />
        );
      })}
    </svg>
  );
}
