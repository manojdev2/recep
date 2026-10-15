"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wordmark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { signIn, signInWith, signUp, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const DEMO_ROLES = [
  {
    role: "user",
    label: "Explore as a business owner",
    hint: "The workspace a customer sees: receptionists, conversations, bookings.",
    landing: "/app",
  },
  {
    role: "admin",
    label: "Explore as the platform admin",
    hint: "The operator's side: accounts, plans, finance, service health.",
    landing: "/admin",
  },
];

export default function LoginPage() {
  const { user, isPending } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const brandingQuery = useQuery({ queryKey: ["branding"], queryFn: () => api.site.branding() });
  const signupsOpen = brandingQuery.data?.signupsOpen ?? true;
  const demoMode = brandingQuery.data?.demoMode ?? false;
  const providers = brandingQuery.data?.socialProviders ?? [];

  useEffect(() => {
    if (!signupsOpen) setMode("in");
  }, [signupsOpen]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState<string | null>(null);

  // A social sign-in that failed comes back as /login?error=…
  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (message) setError(message);
  }, []);

  async function startDemo(role: string) {
    setError(null);
    setDemoPending(role);
    try {
      const res = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: role === "admin" ? "admin" : "owner" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not start the demo session.");
      }
      window.location.assign(DEMO_ROLES.find((r) => r.role === role)?.landing ?? "/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the demo session.");
      setDemoPending(null);
    }
  }

  useEffect(() => {
    if (!isPending && user) router.replace("/app");
  }, [isPending, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "up") await signUp(name.trim() || email.split("@")[0] || "Builder", email, password);
      else await signIn(email, password);
      window.location.href = "/app";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-bg p-3 lg:grid-cols-2 lg:gap-4">
      <section className="relative hidden overflow-hidden rounded-[2rem] lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/florist-hero.png" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md font-landing text-5xl leading-tight tracking-tight text-white">
            More of what you love. Less phone tag.
          </p>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-white/85">
            A friendly receptionist for your business. A little more headspace for you.
          </p>
        </div>
      </section>
      <section className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="self-start">
            <Wordmark name={brandingQuery.data?.name} />
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
            {mode === "in" ? "Lovely to see you again." : "A little help starts here."}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "in"
              ? "Your business, your conversations, all in one place."
              : "Create your free account and meet your receptionist."}
          </p>
          {demoMode && (
            <>
              <div className="mt-8 grid gap-2">
                {DEMO_ROLES.map((r) => (
                  <Button
                    type="button"
                    variant={r.role === "user" ? "primary" : "secondary"}
                    disabled={demoPending !== null}
                    onClick={() => void startDemo(r.role)}
                    className="h-auto flex-col items-start gap-0.5 py-3 text-left"
                    key={r.role}
                  >
                    <span className="text-sm font-medium">{demoPending === r.role ? "Opening the demo…" : r.label}</span>
                    <span className="text-xs font-normal opacity-80">{r.hint}</span>
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-subtle">
                This is a live demo. You can look at everything and talk to a receptionist; saving changes is turned
                off.
              </p>
              <div className="my-6 flex items-center gap-3 text-xs tracking-wide text-subtle uppercase">
                <span className="h-px flex-1 bg-border" />
                or use your own account
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          {providers.length > 0 && (
            <>
              <div className="mt-8 grid gap-2">
                {providers.map((p) => (
                  <Button type="button" variant="secondary" onClick={() => signInWith(p.id)} key={p.id}>
                    Continue with {p.label}
                  </Button>
                ))}
              </div>
              <div className="my-6 flex items-center gap-3 text-xs tracking-wide text-subtle uppercase">
                <span className="h-px flex-1 bg-border" />
                or email
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form className={cn("grid gap-4", providers.length === 0 && "mt-8")} onSubmit={(e) => void onSubmit(e)}>
            {mode === "up" && (
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {signupsOpen ? (
            <button
              type="button"
              className="mt-6 text-sm text-muted hover:text-fg"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError(null);
              }}
            >
              {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          ) : (
            <p className="mt-6 text-sm text-subtle">
              New accounts are closed right now.
              {brandingQuery.data?.supportEmail ? (
                <>
                  {" "}
                  <a href={`mailto:${brandingQuery.data.supportEmail}`} className="text-accent hover:underline">
                    Get in touch
                  </a>
                </>
              ) : null}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
