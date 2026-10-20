"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CARRIERS: Record<string, { inbound: string; outbound: string; note: string }> = {
  twilio: { inbound: "ai", outbound: "ai", note: "Answers calls and places them, with a live conversation." },
  plivo: {
    inbound: "ai",
    outbound: "none",
    note: "Answers calls with a live conversation. Outbound calling is not available on Plivo.",
  },
  sip: {
    inbound: "ai",
    outbound: "none",
    note: "Answers calls that your trunk sends to OpenAI's SIP endpoint. Outbound calling is not available on SIP trunks.",
  },
  vonage: {
    inbound: "none",
    outbound: "limited",
    note: "Azentoo cannot answer calls on Vonage yet. An outbound call plays your greeting as a one-way announcement; it does not hold a conversation.",
  },
  telnyx: {
    inbound: "none",
    outbound: "limited",
    note: "Azentoo cannot answer calls on Telnyx yet. An outbound call is placed on your Call Control connection; what happens once it is answered is set by that connection, not by Azentoo.",
  },
  aether: { inbound: "none", outbound: "none", note: "A test line for trying the workspace. It cannot place or receive real calls." },
  "aether-sip": { inbound: "none", outbound: "none", note: "A test address for trying the workspace. It cannot place or receive real calls." },
};

export function carrier(provider: string) {
  return CARRIERS[provider] ?? { inbound: "none", outbound: "none", note: "Azentoo does not support live calls on this provider." };
}

function canCallOut(provider: string) {
  return carrier(provider).outbound !== "none";
}

function refusal(provider: string) {
  if (canCallOut(provider)) return "";
  switch (provider) {
    case "aether":
    case "aether-sip":
      return "This is a test line, so it cannot place real calls. Import a Twilio number under Phone numbers to call out.";
    case "plivo":
      return "Plivo numbers answer inbound calls only; Azentoo cannot place outbound calls through Plivo. Use a Twilio number to call out.";
    case "sip":
      return "SIP trunk numbers answer inbound calls only; Azentoo cannot place outbound calls on a SIP trunk. Use a Twilio number to call out.";
    default:
      return "Azentoo cannot place outbound calls on this kind of line. Use a Twilio number to call out.";
  }
}

type AgentOption = { id: string; name: string };
type PhoneOption = { id: string; e164: string; label: string; provider: string };
type ContactOption = { id: string; name: string; e164: string };

export function CallDialog({
  open,
  mode,
  agents,
  phones,
  contacts,
  pending,
  error,
  defaultAgentId,
  defaultPhoneId,
  onOpenChange,
  onPlace,
  onInbound,
}: {
  open: boolean;
  mode: "inbound" | "outbound";
  agents: AgentOption[];
  phones: PhoneOption[];
  contacts?: ContactOption[];
  pending: boolean;
  error?: string | null;
  defaultAgentId?: string;
  defaultPhoneId?: string;
  onOpenChange: (open: boolean) => void;
  onPlace: (input: { agentId: string; to: string; phoneId?: string }) => void;
  onInbound: (input: { agentId: string; phoneId?: string; from: string }) => void;
}) {
  const [agentId, setAgentId] = useState(defaultAgentId || "");
  const [phoneId, setPhoneId] = useState(defaultPhoneId || phones[0]?.id || "");
  const [dial, setDial] = useState("");
  const [from, setFrom] = useState("");
  const outbound = mode === "outbound";
  const phone = phones.find((p) => p.id === phoneId);
  const blocked = outbound ? (phone ? refusal(phone.provider) : "Add a phone number first. Outbound calls leave from a number you own.") : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{outbound ? "Place an outbound call" : "Simulate inbound"}</DialogTitle>
        <DialogDescription>
          {outbound
            ? "Places a real call from the number you pick. Twilio numbers hold a live conversation."
            : "Pretend someone just dialed your line. The agent answers with its greeting and workflow."}
        </DialogDescription>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem value={a.id} key={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5">
            <Label>{outbound ? "From" : "To (your number)"}</Label>
            <Select value={phoneId} onValueChange={setPhoneId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose number" />
              </SelectTrigger>
              <SelectContent>
                {phones.map((p) => (
                  <SelectItem value={p.id} key={p.id}>
                    {p.e164} · {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {outbound && phone && canCallOut(phone.provider) ? <p className="text-xs leading-relaxed text-subtle">{carrier(phone.provider).note}</p> : null}
          {outbound ? (
            <>
              {(contacts ?? []).length ? (
                <label className="grid gap-1.5">
                  <Label>Contact</Label>
                  <Select value={dial} onValueChange={setDial}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick from the book" />
                    </SelectTrigger>
                    <SelectContent>
                      {(contacts ?? []).map((c) => (
                        <SelectItem value={c.e164} key={c.id}>
                          {c.name || c.e164} · {c.e164}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
              <label className="grid gap-1.5">
                <Label>Dial</Label>
                <Input value={dial} onChange={(e) => setDial(e.target.value)} placeholder="+1 415 555 0199" autoComplete="tel" />
              </label>
            </>
          ) : (
            <label className="grid gap-1.5">
              <Label>Caller ID</Label>
              <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="+1 415 555 0187" autoComplete="tel" />
            </label>
          )}
          {blocked ? <p className="text-sm text-muted">{blocked}</p> : null}
          {error ? <p className="text-sm text-muted">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !agentId || !!blocked}
              onClick={() => (outbound ? onPlace({ agentId, to: dial, phoneId: phoneId || undefined }) : onInbound({ agentId, phoneId: phoneId || undefined, from }))}
            >
              {pending ? "Placing…" : outbound ? "Call" : "Ring in"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
