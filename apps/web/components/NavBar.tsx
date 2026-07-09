import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton";

export function Logo() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-sm font-black text-black shadow-glow transition group-hover:scale-105">
        ⚡
      </span>
      <span className="text-lg font-bold tracking-tight text-white">
        Fancy<span className="text-white/30">.</span>
      </span>
    </Link>
  );
}

export function PublicNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-canvas/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-white/60 transition hover:text-white sm:inline"
          >
            OSS · AGPL
          </a>
          <Link href="/admin" className="btn-primary">
            Open dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function AdminNav({ title, back }: { title?: string; back?: { href: string; label: string } }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-canvas/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          {back ? (
            <Link href={back.href} className="hidden text-sm text-white/50 transition hover:text-white sm:inline">
              ← {back.label}
            </Link>
          ) : null}
          {title ? <span className="hidden text-sm text-white/30 sm:inline">/ {title}</span> : null}
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/admin" className="btn-secondary">
            Dashboard
          </Link>
          <Link href="/admin/new" className="btn-primary">
            + New API
          </Link>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
