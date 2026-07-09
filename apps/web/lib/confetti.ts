import confetti from "canvas-confetti";

/**
 * A short, tasteful confetti burst in the brand colors. Fired on milestone
 * moments (API created, etc.) — never blocking, never awaited.
 */
export function fireConfetti(): void {
  if (typeof window === "undefined") return;

  const colors = ["#a78bfa", "#67e8f9", "#8b5cf6", "#22d3ee", "#f4f4f7"];

  confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors,
    zIndex: 9999,
  });

  window.setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 100,
      startVelocity: 35,
      origin: { x: 0.2, y: 0.5 },
      colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 60,
      spread: 100,
      startVelocity: 35,
      origin: { x: 0.8, y: 0.5 },
      colors,
      zIndex: 9999,
    });
  }, 180);
}
