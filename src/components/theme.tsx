"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "aether-theme";
const DARK_BG = "#0d0d12";
const LIGHT_BG = "#f5f7fa";
const DEFAULT: ThemeChoice = "dark";

/** Runs before paint so the first frame already has the right theme. */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"&&t!=="system")t=${JSON.stringify(DEFAULT)};var light=t==="light"||(t!=="dark"&&window.matchMedia("(prefers-color-scheme: light)").matches);var r=light?"light":"dark";var el=document.documentElement;el.classList.remove("light","dark");el.classList.add(r);el.style.colorScheme=r;el.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",r==="light"?${JSON.stringify(LIGHT_BG)}:${JSON.stringify(DARK_BG)});}catch(e){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}})();`;

function isChoice(v: unknown): v is ThemeChoice {
  return v === "light" || v === "dark" || v === "system";
}

function stored(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (isChoice(v)) return v;
  } catch {}
  return DEFAULT;
}

function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function apply(choice: ThemeChoice) {
  const resolved = resolve(choice);
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(resolved);
  el.style.colorScheme = resolved;
  el.dataset.theme = choice;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "light" ? LIGHT_BG : DARK_BG);
  return resolved;
}

type ThemeCtx = { theme: ThemeChoice; resolved: "light" | "dark"; setTheme: (t: ThemeChoice) => void };
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(DEFAULT);
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useLayoutEffect(() => {
    const t = stored();
    setThemeState(t);
    setResolved(apply(t));
  }, []);

  useLayoutEffect(() => {
    const onScheme = () => {
      if (stored() === "system") setResolved(apply("system"));
    };
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", onScheme);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      const t = isChoice(e.newValue) ? e.newValue : DEFAULT;
      setThemeState(t);
      setResolved(apply(t));
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onScheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((t: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    setThemeState(t);
    setResolved(apply(t));
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cn(
        "grid size-11 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-raised hover:text-fg",
        className,
      )}
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={resolved === "dark" ? "Light mode" : "Dark mode"}
    >
      <Sun className="hidden size-4 dark:block" strokeWidth={1.6} />
      <Moon className="size-4 dark:hidden" strokeWidth={1.6} />
    </button>
  );
}

const CHOICES = [
  { id: "light" as const, label: "Light", hint: "Soft daylight", icon: Sun },
  { id: "dark" as const, label: "Dark", hint: "Midnight blue", icon: Moon },
  { id: "system" as const, label: "System", hint: "Match device", icon: Monitor },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid grid-cols-3 gap-2">
      {CHOICES.map((c) => {
        const active = theme === c.id;
        return (
          <button
            type="button"
            onClick={() => setTheme(c.id)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-start gap-3 rounded-xl p-3 text-left transition-[box-shadow,background-color] duration-150",
              active
                ? "bg-raised shadow-[var(--shadow-border-hover)]"
                : "bg-raised/50 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
            )}
            key={c.id}
          >
            <span
              className={cn("grid size-8 place-items-center rounded-lg", active ? "bg-accent text-accent-fg" : "bg-surface text-muted")}
            >
              <c.icon className="size-4" strokeWidth={1.6} />
            </span>
            <span>
              <span className="block text-sm font-medium">{c.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{c.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
