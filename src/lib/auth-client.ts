"use client";

import { useQuery } from "@tanstack/react-query";

export type CurrentUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
  adminLevel: string | null;
};

type SessionPayload = {
  user: { id: string; email: string; name: string; image: string | null; adminLevel: string | null };
} | null;

async function fetchSession(): Promise<SessionPayload> {
  const res = await fetch("/api/auth/session", { credentials: "same-origin" });
  if (!res.ok) return null;
  return res.json();
}

export function useSession() {
  const { data, isPending } = useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 60_000 });
  const u = data?.user;
  const user: CurrentUser | null = u
    ? {
        id: u.id,
        displayName: u.name ?? null,
        primaryEmail: u.email ?? null,
        profileImageUrl: u.image ?? null,
        isDevFallback: false,
        adminLevel: u.adminLevel,
      }
    : null;
  return { user, isPending };
}

export function useCurrentUser() {
  return useSession().user;
}

export async function signIn(email: string, password: string) {
  const res = await fetch("/api/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not sign in");
  return body;
}

export async function signUp(name: string, email: string, password: string) {
  const res = await fetch("/api/auth/sign-up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not create account");
  return body;
}

export async function signOut(to = "/") {
  try {
    await fetch("/api/auth/sign-out", { method: "POST" });
  } finally {
    window.location.href = to;
  }
}

/** Start a social sign-in (only providers the server reports as configured are offered). */
export function signInWith(provider: string) {
  // An API route that redirects to the provider, not a page — it needs a real navigation.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/api/auth/${provider}/start`);
}
