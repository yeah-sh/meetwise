// A faint section divider: a hairline with a small waveform at its centre. Lines and bars share the
// text colour (faint ink by default), so a text-* class recolours both.
import { Waveform } from "@/components/brand/waveform";
import { cn } from "@/lib/utils";

export function WaveDivider({ className }: { className?: string }) {
  return (
    <div role="separator" className={cn("flex items-center gap-3 text-foreground/15", className)}>
      <span className="h-px flex-1 bg-current" />
      <Waveform width={42} height={12} className="shrink-0" />
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}
