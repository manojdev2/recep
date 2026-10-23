"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mark } from "@/components/mark";
import { FormSkeleton } from "@/components/app/skeletons";
import { TalkPanel } from "@/components/talk-panel";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const NO_WIDGET = { color: "", logoUrl: "", headline: "", hideBrand: false, allowedDomains: [] as string[] };

const DEMO = {
  id: "demo",
  name: "Azentoo",
  tagline: "A warm welcome for every caller.",
  greeting: "Hi, I’m Azentoo — an AI receptionist, here as a demo. What would you like to know?",
  voiceId: "marin",
  language: "en",
  status: "live",
  preview: false,
  widget: NO_WIDGET,
};

export default function WidgetLinePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const query = useQuery({ queryKey: ["public-agent", agentId], queryFn: () => api.demo.agent(agentId) });
  if (query.isPending) return <FormSkeleton lines={3} />;
  const line = query.data ?? (agentId === "demo" ? DEMO : null);

  if (!line) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div className="max-w-sm">
          <Mark className="mx-auto size-10" />
          <p className="mt-6 text-xl font-medium tracking-tight">This line isn’t public</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The link may be wrong, or the agent is still in draft. If you built it, open it from the studio and set it live — then anyone with the link can talk.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/app">Open studio</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Back to Azentoo</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const widget = line.widget ?? NO_WIDGET;
  const color = widget.color?.trim();
  return (
    <div className="relative flex min-h-dvh flex-col bg-bg" style={color ? ({ "--color-accent": color, "--color-primary": color } as CSSProperties) : undefined}>
      {line.preview ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs text-muted">
          <span>Draft — visitors won’t see this yet.</span>
          <Link href={`/app/agents/${line.id}`} className="shrink-0 font-medium text-fg hover:underline">
            Go live
          </Link>
        </div>
      ) : null}
      <ThemeToggle className="absolute top-3 right-3 z-10 size-10" />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-4 sm:px-6">
        {(widget.logoUrl || widget.headline) && (
          <header className="flex items-center gap-3 pt-10 pb-2">
            {widget.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={widget.logoUrl} alt="" crossOrigin="anonymous" className="size-10 rounded-lg object-cover" />
            ) : null}
            {widget.headline ? <p className="text-lg font-medium tracking-tight">{widget.headline}</p> : null}
          </header>
        )}
        <TalkPanel agentId={line.id} greeting={line.greeting} agentName={line.name} mode="public" variant="widget" language={line.language} />
        {widget.hideBrand ? null : <p className="pb-6 text-center text-[11px] tracking-[0.16em] text-subtle uppercase">Powered by Azentoo</p>}
      </div>
    </div>
  );
}
