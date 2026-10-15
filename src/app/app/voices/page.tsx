"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Play, Square } from "lucide-react";
import { Page, PageBody, PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { VoicePortrait } from "@/components/voice-portrait";
import { api } from "@/lib/api";
import { VOICES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export default function VoicesPage() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  async function toggle(id: string) {
    if (playing === id) {
      audio.current?.pause();
      audio.current = null;
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const out = await api.chat.speak({ voiceId: id });
    if (!out.ok) {
      toast.error(out.error);
      return;
    }
    const el = new Audio(`data:audio/mpeg;base64,${out.audioBase64}`);
    audio.current = el;
    setPlaying(id);
    el.onended = () => {
      setPlaying(null);
      audio.current = null;
    };
    await el.play();
  }

  return (
    <Page>
      <PageHeader title="Find your voice" description="Warm, bright, or wonderfully calm. Listen and find the right fit for your business." />
      <PageBody className="p-4 sm:p-6">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {VOICES.map((v) => {
            const on = playing === v.id;
            return (
              <li key={v.id}>
                <article
                  className={cn(
                    "flex h-full flex-col items-center rounded-xl bg-bg px-2 py-3 text-center shadow-[var(--shadow-border)]",
                    on && "shadow-[var(--shadow-border-hover)]",
                  )}
                >
                  <VoicePortrait id={v.id} size={48} className="size-12" />
                  <p className="mt-2 w-full truncate text-sm font-medium tracking-tight">{v.name}</p>
                  <p className="mt-0.5 line-clamp-1 w-full text-[11px] text-muted">{v.tone}</p>
                  <Button type="button" variant={on ? "primary" : "secondary"} size="sm" className="mt-2 h-8 w-full min-w-0 px-2" onClick={() => void toggle(v.id)}>
                    {on ? <Square className="size-3" /> : <Play className="size-3" />}
                    {on ? "Stop" : "Hear"}
                  </Button>
                </article>
              </li>
            );
          })}
        </ul>
      </PageBody>
    </Page>
  );
}
