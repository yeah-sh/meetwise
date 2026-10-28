"use client";

// Light/dark switch. THEME_SCRIPT (src/lib/theme.ts) applies the saved or OS theme before the page
// paints; this button flips it and remembers the choice. Until the user picks one, the theme
// follows the operating system.
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function savedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null; // storage blocked, e.g. by privacy settings
  }
}

export function ThemeToggle() {
  // Follow live OS theme changes until the user has made a choice.
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!savedTheme()) document.documentElement.classList.toggle("dark", query.matches);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      // Not saved; the theme still changes for this visit.
    }
  }

  // Both icons are rendered and CSS shows the right one, so server and browser HTML always match.
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode">
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
