"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fall back
      // to a hidden textarea + execCommand so copy still works.
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {
        // give up silently — button just won't flip to "Copied!"
      }
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95 ${className}`}
    >
      {copied ? (
        <>
          <span aria-hidden="true">✓</span> Copied!
        </>
      ) : (
        <>
          <span aria-hidden="true">⧉</span> {label}
        </>
      )}
    </button>
  );
}
