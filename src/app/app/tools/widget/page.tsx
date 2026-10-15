"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Page, PageBody } from "@/components/app/page";
import { ToolHeader } from "@/components/app/tool-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

export default function WidgetPage() {
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.agents.list() });
  const [picked, setPicked] = useState("");
  const agentId = picked || agents.data?.[0]?.id || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const script = useMemo(() => (agentId ? `<script src="${origin}/widget.js" data-agent="${agentId}" defer></script>` : ""), [agentId, origin]);
  const inline = useMemo(
    () =>
      agentId
        ? `<iframe src="${origin}/w/${agentId}" title="Reception AI" style="width:100%;height:640px;border:0;border-radius:16px" allow="microphone"></iframe>`
        : "",
    [agentId, origin],
  );

  return (
    <Page>
      <ToolHeader title="Website widget" description="Embed the talk line. Set the agent live first." />
      <PageBody className="p-4 sm:p-6">
        <div className="grid max-w-3xl gap-5">
          <label className="grid gap-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setPicked}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {(agents.data ?? []).map((a) => (
                  <SelectItem value={a.id} key={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {script ? (
            <>
              <div className="rounded-2xl bg-raised p-4">
                <p className="text-xs tracking-wide text-subtle uppercase">Embed</p>
                <p className="mt-1 text-sm text-muted">
                  Paste before <code className="font-mono text-xs">{"</body>"}</code>. Adds a chat bubble; the agent loads only when a visitor opens it.
                </p>
                <pre className="mt-3 overflow-x-auto font-mono text-xs break-all whitespace-pre-wrap">{script}</pre>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(script);
                    toast.success("Snippet copied");
                  }}
                >
                  Copy snippet
                </Button>
              </div>
              <details className="rounded-2xl bg-raised/60 p-4">
                <summary className="cursor-pointer text-sm text-muted">Embed inline instead of as a bubble</summary>
                <pre className="mt-3 overflow-x-auto font-mono text-xs break-all whitespace-pre-wrap">{inline}</pre>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(inline);
                    toast.success("Inline snippet copied");
                  }}
                >
                  Copy inline snippet
                </Button>
              </details>
              <p className="text-xs leading-relaxed text-muted">
                By default the agent runs on any site that has the snippet. Restrict it to your own domains in the agent’s Share settings — otherwise anyone
                who copies the snippet can run your agent and spend your minutes.
              </p>
              <div className="overflow-hidden rounded-2xl bg-bg shadow-[var(--shadow-border)]">
                <iframe title="Widget preview" src={`/w/${agentId}`} className="h-80 w-full border-0 sm:h-96" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Create an agent first, then embed it.</p>
          )}
        </div>
      </PageBody>
    </Page>
  );
}
