// The home page's hero drawing: a recording turning into a report. The MeetWise waveform on the left
// fades into three dotted trails, one per small report card stacked on the right: a task, a decision
// and a risk, each in its category colour with its icon in a stamp, as on the report page.
// Static and decorative. The ids are fixed because the drawing appears once, on the home page.
import { Gavel, ListTodo, TriangleAlert, type LucideIcon } from "lucide-react";
import { Waveform } from "@/components/brand/waveform";

type HeroCard = {
  label: string;
  icon: LucideIcon;
  x: number;
  y: number;
  tilt: number; // degrees, so the stack looks laid down by hand
  // Written out in full so Tailwind can find the class names.
  rule: string;
  tint: string;
  ring: string;
  ink: string; // the label and icon
  trail: string;
};

const CARDS: HeroCard[] = [
  {
    label: "Task",
    icon: ListTodo,
    x: 300,
    y: 26,
    tilt: -2,
    rule: "fill-cat-task",
    tint: "fill-cat-task/15",
    ring: "stroke-cat-task/60",
    ink: "text-cat-task-foreground",
    trail: "stroke-cat-task/70",
  },
  {
    label: "Decision",
    icon: Gavel,
    x: 316,
    y: 92,
    tilt: 1.5,
    rule: "fill-cat-decision",
    tint: "fill-cat-decision/15",
    ring: "stroke-cat-decision/60",
    ink: "text-cat-decision-foreground",
    trail: "stroke-cat-decision/70",
  },
  {
    label: "Risk",
    icon: TriangleAlert,
    x: 306,
    y: 158,
    tilt: -1,
    rule: "fill-cat-risk",
    tint: "fill-cat-risk/15",
    ring: "stroke-cat-risk/60",
    ink: "text-cat-risk-foreground",
    trail: "stroke-cat-risk/70",
  },
];

const CARD_WIDTH = 196;
const CARD_HEIGHT = 56;
// Where the trails leave the waveform.
const TRAIL_START = { x: 226, y: 120 };

export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 520 240" className={className}>
      <defs>
        <linearGradient id="hero-wave-fade" x1="0" x2="1">
          <stop offset="0.5" stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0.25" />
        </linearGradient>
        <mask id="hero-wave-mask">
          <rect x="10" y="88" width="208" height="64" fill="url(#hero-wave-fade)" />
        </mask>
      </defs>

      <g mask="url(#hero-wave-mask)">
        <g transform="translate(10 90)">
          <Waveform width={208} height={60} className="text-primary" />
        </g>
      </g>

      {CARDS.map(({ label, x, y, trail }) => {
        const centre = y + CARD_HEIGHT / 2;
        const end = x - 8;
        return (
          <path
            key={label}
            d={`M${TRAIL_START.x} ${TRAIL_START.y} C${TRAIL_START.x + 34} ${TRAIL_START.y} ${end - 34} ${centre} ${end} ${centre}`}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="0 8"
            className={trail}
          />
        );
      })}

      {CARDS.map((card) => (
        <Card key={card.label} {...card} />
      ))}
    </svg>
  );
}

function Card({ label, icon: Icon, x, y, tilt, rule, tint, ring, ink }: HeroCard) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt} ${CARD_WIDTH / 2} ${CARD_HEIGHT / 2})`}>
      {/* A flat paper shadow, then the card with its coloured rule down the left edge. */}
      <rect x="2" y="4" width={CARD_WIDTH} height={CARD_HEIGHT} rx="12" className="fill-foreground/6" />
      <rect width={CARD_WIDTH} height={CARD_HEIGHT} rx="12" className="fill-card stroke-foreground/12" />
      <rect x="7" y="12" width="3" height={CARD_HEIGHT - 24} rx="1.5" className={rule} />
      {/* The category stamp: a tinted, double-ruled square, set slightly askew. */}
      <g transform="translate(32 28) rotate(-4)" className={ink}>
        <rect x="-14" y="-14" width="28" height="28" rx="5" strokeWidth={1.25} className={`${tint} ${ring}`} />
        <rect x="-11" y="-11" width="22" height="22" rx="3" fill="none" className={ring} />
        <Icon x={-7} y={-7} size={14} />
      </g>
      <text x="56" y="22" className={`fill-current text-[14px] font-semibold ${ink}`}>
        {label}
      </text>
      <rect x="56" y="29" width="104" height="5" rx="2.5" className="fill-foreground/12" />
      <rect x="56" y="39" width="68" height="5" rx="2.5" className="fill-foreground/8" />
    </g>
  );
}
