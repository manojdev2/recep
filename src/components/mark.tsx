import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      {/* Fixed fluorescent colours (not theme tokens) so the mark looks the same in light and dark. */}
      <rect width="40" height="40" rx="13" fill="#cbff3d" />
      {/* The Azentoo "A". Keep public/favicon.svg, public/icon-180.png and the docs topbar in step. */}
      <path
        d="M11.5 30 18.1 12.4a2 2 0 0 1 3.8 0L28.5 30"
        fill="none"
        stroke="#0d0d12"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.6 24h8.8" fill="none" stroke="#0d0d12" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30.5" cy="9.5" r="3" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark({ className, name = "Azentoo" }: { className?: string; name?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark />
      <span className="whitespace-nowrap font-logo text-xl font-semibold tracking-[-.04em] text-fg">{name}</span>
    </span>
  );
}
