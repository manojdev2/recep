import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <rect width="40" height="40" rx="13" className="fill-accent" />
      <path
        d="M11 29V12a2 2 0 0 1 2-2h8a7 7 0 0 1 0 14h-4l-6 5Z"
        fill="none"
        className="stroke-accent-fg"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="m21 24 7 6" fill="none" className="stroke-accent-fg" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 16v3M22 15v5" className="stroke-accent-fg" strokeWidth="2" strokeLinecap="round" />
      <circle cx="30.5" cy="9.5" r="3" fill="#bbf3d5" />
    </svg>
  );
}

export function Wordmark({ className, name = "Reception AI" }: { className?: string; name?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark />
      <span className="whitespace-nowrap text-xl font-semibold tracking-[-.045em] text-fg">{name}</span>
    </span>
  );
}
