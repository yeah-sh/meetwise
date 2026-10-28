"use client";

// The top bar's links, with the current section highlighted.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/meetings", label: "Meetings", icon: List },
  { href: "/upload", label: "Upload", icon: Upload },
] as const;

// Plain links with no highlight. Also the Suspense fallback in site-header.tsx: with cacheComponents,
// usePathname suspends while prerendering pages with dynamic params such as /meetings/[id].
export function NavLinkList({ pathname }: { pathname?: string }) {
  return (
    <>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {/* Icons are hidden on phones so the bar fits at 375px. */}
            <Icon className="hidden size-4 sm:block" />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function NavLinks() {
  return <NavLinkList pathname={usePathname()} />;
}
