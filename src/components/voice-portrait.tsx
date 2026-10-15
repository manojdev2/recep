"use client";

import { useState } from "react";
import { VOICES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const WITH_PORTRAIT = new Set(VOICES.filter((v) => v.provider === "aether").map((v) => v.id));
const TINTS = [
  "bg-[#C7BFA8] text-[#3A3527]",
  "bg-[#B9C3B4] text-[#2C332A]",
  "bg-[#C6BAB2] text-[#38302B]",
  "bg-[#BCC0CA] text-[#2C303A]",
  "bg-[#CBBFC6] text-[#3A2F35]",
];

function tint(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export function VoicePortrait({ id, size = 48, className }: { id: string; size?: number; className?: string }) {
  const voice = VOICES.find((v) => v.id === id);
  const [failed, setFailed] = useState(false);
  if (WITH_PORTRAIT.has(id) && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/voices/${id}.jpg`}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={cn("flex shrink-0 items-center justify-center rounded-full font-medium select-none", tint(id), className)}
    >
      {(voice?.name ?? id).charAt(0).toUpperCase()}
    </span>
  );
}
