// Light/dark theme: the "dark" class on <html> (see the dark variant in globals.css).
// Browser-safe; a plain module so the server layout can import THEME_SCRIPT as a string.

export const THEME_STORAGE_KEY = "theme"; // localStorage: "light" | "dark", absent = follow the OS

// Runs inline in <head> (see layout.tsx) before the page paints, so there is no flash of the wrong
// theme. Kept tiny and self-contained because it runs before React loads.
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.classList.toggle("dark",t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)}catch(e){}`;
