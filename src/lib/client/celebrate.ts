"use client";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Small confetti burst in the app's blues. Skipped for reduced motion. */
export async function celebrate() {
  if (prefersReducedMotion()) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#2b8ceb", "#7cc4fa", "#bfe0fd", "#1fa36b", "#ffffff"];
  confetti({ particleCount: 70, spread: 70, startVelocity: 38, origin: { y: 0.35 }, colors, scalar: 0.9, disableForReducedMotion: true });
  setTimeout(
    () => confetti({ particleCount: 40, spread: 100, startVelocity: 28, origin: { y: 0.4 }, colors, scalar: 0.8, disableForReducedMotion: true }),
    180,
  );
}

export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
