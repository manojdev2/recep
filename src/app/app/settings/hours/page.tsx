"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleAlert, Plus, Sparkles, X } from "lucide-react";
import { HoursSkeletonBody } from "@/components/app/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ApiResult } from "@/lib/api";
import type { HoursWindow } from "@/server/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function fromHHMM(s: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

function browserZone() {
  if (typeof window === "undefined") return "";
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return "";
  }
}

function zones() {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [...new Set([mine, ...all].filter(Boolean))];
}

function useBrowserZone() {
  return useSyncExternalStore(
    () => () => {},
    browserZone,
    () => "",
  );
}

function ZoneSection({ current }: { current: string }) {
  const qc = useQueryClient();
  const detected = useBrowserZone();
  const [zone, setZone] = useState(current);
  useEffect(() => setZone(current || detected), [current, detected]);
  const chosen = zone || detected;
  const save = useMutation({
    mutationFn: () => api.hours.setTimeZone({ timeZone: chosen }),
    onSuccess: async (out) => {
      await qc.invalidateQueries();
      toast.success(out.created ? `Timezone saved — ${out.created} times rebuilt` : "Timezone saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="rounded-xl bg-raised/60 p-5">
      <p className="text-xs tracking-wide text-subtle uppercase">Where you are</p>
      <p className="mt-1 text-sm text-muted">Your opening hours are in this timezone. Everything your agent says to a caller uses it.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={chosen} onChange={(e) => setZone(e.target.value)} className="h-9 max-w-xs flex-1 rounded-lg bg-surface px-3 text-sm shadow-[var(--shadow-border)]">
          {!current && !detected ? <option value="">Choose your timezone…</option> : null}
          {zones().map((z) => (
            <option value={z} key={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => save.mutate()} disabled={!chosen || chosen === (current || detected) || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {!current && !detected ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          Until you set this, your agents cannot offer appointment times at all.
        </p>
      ) : null}
    </section>
  );
}

function DayRow({ weekday, windows, onChange }: { weekday: number; windows: HoursWindow[]; onChange: (w: HoursWindow[]) => void }) {
  const mine = windows.filter((w) => w.weekday === weekday);
  const others = windows.filter((w) => w.weekday !== weekday);
  const set = (next: HoursWindow[]) => onChange([...others, ...next]);
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="w-24 shrink-0 pt-1.5 text-sm">{DAYS[weekday]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {mine.length === 0 ? (
          <span className="pt-1.5 text-sm text-subtle">Closed</span>
        ) : (
          mine.map((w, i) => (
            <div className="flex flex-wrap items-center gap-1.5" key={i}>
              <Input
                type="time"
                value={toHHMM(w.startMin)}
                onChange={(e) => {
                  const v = fromHHMM(e.target.value);
                  if (v === null) return;
                  const copy = [...mine];
                  copy[i] = { ...w, startMin: v };
                  set(copy);
                }}
                className="h-8 w-28"
              />
              <span className="text-xs text-subtle">to</span>
              <Input
                type="time"
                value={toHHMM(w.endMin === 1440 ? 1439 : w.endMin)}
                onChange={(e) => {
                  const v = fromHHMM(e.target.value);
                  if (v === null) return;
                  const copy = [...mine];
                  copy[i] = { ...w, endMin: v };
                  set(copy);
                }}
                className="h-8 w-28"
              />
              {w.endMin <= w.startMin ? <span className="text-xs text-red-500">must be later</span> : null}
              <Button size="sm" variant="ghost" onClick={() => set(mine.filter((_, j) => j !== i))} title="Remove">
                <X className="size-3" />
              </Button>
            </div>
          ))
        )}
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          set([...mine, mine.length ? { weekday, startMin: 780, endMin: 1020 } : { weekday, startMin: 540, endMin: 1020 }])
        }
      >
        <Plus className="size-3" />
        {mine.length ? "Add" : "Open"}
      </Button>
    </div>
  );
}

type AgentHours = ApiResult<"hours", "get">["agents"][number];

const sortWindows = (w: HoursWindow[]) => [...w].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);

function AgentSection({ agent, hasZone }: { agent: AgentHours; hasZone: boolean }) {
  const qc = useQueryClient();
  const [windows, setWindows] = useState(agent.windows);
  const [slot, setSlot] = useState(agent.slotMinutes);
  const [horizon, setHorizon] = useState(agent.horizonDays);
  useEffect(() => {
    setWindows(agent.windows);
    setSlot(agent.slotMinutes);
    setHorizon(agent.horizonDays);
  }, [agent]);
  const suggest = useMutation({
    mutationFn: () => api.hours.suggest({ agentId: agent.agentId }),
    onSuccess: (out) => {
      setWindows(out.windows);
      setSlot(out.slotMinutes);
      toast.message("Filled in a starting point — check it before saving.");
    },
  });
  const save = useMutation({
    mutationFn: () => api.hours.save({ agentId: agent.agentId, windows, slotMinutes: slot, horizonDays: horizon }),
    onSuccess: async (out) => {
      await qc.invalidateQueries();
      toast.success(`${out.created} appointment times available`);
      if (out.orphanedBookings > 0) {
        toast.warning(
          `${out.orphanedBookings} existing booking${out.orphanedBookings === 1 ? " falls" : "s fall"} outside your new hours. They are still booked — call those customers.`,
          { duration: 12000 },
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const invalid = windows.some((w) => w.endMin <= w.startMin);
  const dirty =
    JSON.stringify(sortWindows(windows)) !== JSON.stringify(sortWindows(agent.windows)) || slot !== agent.slotMinutes || horizon !== agent.horizonDays;

  return (
    <section className="rounded-xl bg-raised/60 p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-xs tracking-wide text-subtle uppercase">{agent.agentName}</p>
        <span className="ml-auto text-xs text-muted">
          {agent.openSlots} times open{agent.bookedSlots ? ` · ${agent.bookedSlots} booked` : ""}
        </span>
      </div>
      {agent.fabricatedSlots > 0 ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {agent.fabricatedSlots} of the times this agent is currently offering were generated automatically from your trade, not from your real hours. Set
            your hours below and save to replace them — anything already booked is kept.
          </span>
        </p>
      ) : agent.unset ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          No hours set, so this agent will not offer any appointment time. It takes a message and a callback number instead.
        </p>
      ) : null}
      <div className="mt-3">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <DayRow weekday={d} windows={windows} onChange={setWindows} key={d} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-xs text-muted">
          <span className="mb-1 block">Appointment length</span>
          <div className="flex items-center gap-1.5">
            <Input type="number" min={5} max={480} value={slot} onChange={(e) => setSlot(Number(e.target.value))} className="h-8 w-20" />
            <span>minutes</span>
          </div>
        </label>
        <label className="text-xs text-muted">
          <span className="mb-1 block">Diary runs</span>
          <div className="flex items-center gap-1.5">
            <Input type="number" min={1} max={120} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="h-8 w-20" />
            <span>days ahead</span>
          </div>
        </label>
        <Button size="sm" variant="secondary" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
          <Sparkles className="size-3" />
          Suggest for my trade
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => save.mutate()} disabled={!hasZone || invalid || !dirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save hours"}
        </Button>
      </div>
      {invalid ? <p className="mt-2 text-xs text-red-500">A closing time has to be after its opening time.</p> : null}
    </section>
  );
}

export default function HoursPage() {
  const hours = useQuery({ queryKey: ["hours"], queryFn: () => api.hours.get() });
  if (hours.isPending) return <HoursSkeletonBody />;
  return (
    <div className="grid max-w-2xl gap-4">
      <ZoneSection current={hours.data?.timeZone ?? ""} />
      {hours.data?.agents.length ? (
        hours.data.agents.map((a) => <AgentSection agent={a} hasZone={!!hours.data.timeZone} key={a.agentId} />)
      ) : (
        <section className="rounded-xl bg-raised/60 p-5">
          <p className="text-sm text-muted">You have no agents yet. Create one and its opening hours will appear here.</p>
        </section>
      )}
    </div>
  );
}
