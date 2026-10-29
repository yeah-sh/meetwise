// The app's top bar: name, section links and the dark-mode toggle. Sticks to the top while scrolling.
import Link from "next/link";
import { Suspense } from "react";
import { WaveformMark } from "@/components/brand/waveform";
import { NavLinkList, NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
        <Link
          href="/"
          className="mr-auto flex items-center gap-2 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* The logo mark: the waveform in brand ink. */}
          <WaveformMark width={23} height={24} className="text-primary" />
          MeetWise
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Suspense fallback={<NavLinkList />}>
            <NavLinks />
          </Suspense>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
