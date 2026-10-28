// The app's top bar: name, section links and the dark-mode toggle. Sticks to the top while scrolling.
import Link from "next/link";
import { Suspense } from "react";
import { AudioLines } from "lucide-react";
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
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <AudioLines className="size-4" />
          </span>
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
