import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-muted" aria-hidden="true">
        <Compass className="size-10" strokeWidth={1.5} />
      </span>
      <h1 className="text-2xl font-medium tracking-tight">This page doesn’t exist</h1>
      <p className="max-w-md text-sm text-muted">The link may be out of date, or the thing it pointed at may have been deleted.</p>
      <div className="mt-4 flex gap-2">
        <Link href="/app" className="rounded-lg bg-raised px-4 py-2 text-sm text-fg shadow-[var(--shadow-border)] hover:opacity-90">
          Go to the studio
        </Link>
        <Link href="/" className="rounded-lg px-4 py-2 text-sm text-muted hover:text-fg">
          Home
        </Link>
      </div>
    </main>
  );
}
