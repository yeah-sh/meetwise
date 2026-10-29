// A line drawing of a microphone whose cable has come out of the socket, for the chat panel while
// the chat is not available. Static and decorative. Lines use currentColor (set it with a text-*
// class); the cable and plug are in the brand colour. Size it with a width class, e.g. w-32.
export function UnpluggedMic({ className }: { className?: string }) {
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
      {/* The microphone: head and grille, holder, stem and base. */}
      <rect x="34" y="10" width="28" height="46" rx="14" className="fill-muted" />
      <path d="M41 24 H55 M41 31 H55 M41 38 H55" className="opacity-60" />
      <path d="M26 40 V44 A22 22 0 0 0 70 44 V40" />
      <path d="M48 66 V80" />
      <rect x="34" y="80" width="28" height="6" rx="3" className="fill-muted" />
      {/* The cable and its plug, short of the socket. */}
      <path d="M62 83 C80 83 78 104 94 102" className="stroke-primary" />
      <rect x="94" y="96" width="14" height="12" rx="3" className="fill-primary/15 stroke-primary" />
      <path d="M108 99.5 H113 M108 104.5 H113" className="stroke-primary" />
      <path d="M120.5 94 V89 M116.5 95 L114 92 M124.5 95 L127 92" className="opacity-60" />
      {/* The socket. */}
      <rect x="128" y="88" width="16" height="28" rx="4" className="fill-muted" />
      <path d="M133 99.5 H135.5 M133 104.5 H135.5" />
    </svg>
  );
}
