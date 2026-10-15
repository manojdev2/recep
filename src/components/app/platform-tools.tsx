import Link from "next/link";
import { ToolMark } from "@/components/brand-marks";

export const PLATFORM_TOOLS = [
  { id: "forms", to: "/app/tools/forms", title: "Forms", hint: "Create and manage forms to collect data from contacts and leads." },
  { id: "appointments", to: "/app/tools/appointments", title: "Appointments", hint: "Manage bookings from your AI agents and forms." },
  { id: "webhooks", to: "/app/tools/webhooks", title: "Webhooks", hint: "Send live events to your own endpoints." },
  { id: "widget", to: "/app/tools/widget", title: "Website widget", hint: "Embed an AI talk widget on your site." },
  { id: "crm", to: "/app/tools/crm", title: "Quick CRM", hint: "Leads on a board, with filters." },
  { id: "incoming", to: "/app/tools/incoming", title: "Incoming connections", hint: "Route callers to the right agent." },
  { id: "messaging", to: "/app/tools/messaging", title: "WhatsApp & email", hint: "WhatsApp Business and Gmail from the same agents." },
  { id: "sheets", to: "/app/tools/sheets", title: "Google Sheets", hint: "Push appointments, forms, and leads as they happen." },
];

export function PlatformTools({ query = "", stats }: { query?: string; stats?: Record<string, string> }) {
  const q = query.trim().toLowerCase();
  const shown = PLATFORM_TOOLS.filter((t) => !q || t.title.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q));
  if (!shown.length) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {shown.map((t) => (
        <li key={t.id}>
          <Link href={t.to} className="flex h-full gap-3 rounded-2xl bg-bg p-4 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]">
            <ToolMark id={t.id} />
            <span className="min-w-0">
              <span className="block text-sm font-medium tracking-tight">{t.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{t.hint}</span>
              {stats?.[t.id] ? <span className="mt-2 block text-[11px] text-subtle">{stats[t.id]}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
