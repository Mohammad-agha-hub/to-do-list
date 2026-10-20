"use client";

export type Theme = "light" | "dark" | "system";

export function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** Applies a theme immediately and remembers it on this device (the layout script reads it before paint). */
export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* ignore */
  }
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Keeps "system" in sync when the OS switches between light and dark. */
export function watchSystemTheme() {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => getStoredTheme() === "system" && applyTheme("system");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
