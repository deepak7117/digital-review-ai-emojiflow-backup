"use client";

import { useState, useTransition } from "react";
import {
  sendAdminCommunication,
  listCommunicationHistory,
  type CommunicationRecord,
} from "@/app/admin/communicationActions";

const STATUS_TONE: Record<string, string> = {
  queued: "bg-ink/5 text-slate",
  submitted: "bg-voice-tint text-voice-dark",
  delivered: "bg-success-tint text-success-dark",
  failed: "bg-danger-tint text-danger",
  unknown: "bg-gold-tint text-gold",
};

export function CommunicationCenter({ initialHistory }: { initialHistory: CommunicationRecord[] }) {
  const [history, setHistory] = useState(initialHistory);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await sendAdminCommunication({
        channel,
        recipient,
        templateType: "general_notice",
        subject: channel === "email" ? subject : undefined,
        body,
      });
      if ("error" in res) {
        setResult({ ok: false, message: res.error });
        return;
      }
      setResult({
        ok: res.status !== "failed",
        message:
          res.status === "failed"
            ? "No message was actually sent — no provider is configured in this environment."
            : `Submitted to the provider (status: ${res.status}).`,
      });
      setRecipient("");
      setSubject("");
      setBody("");
      const refreshed = await listCommunicationHistory();
      if ("data" in refreshed) setHistory(refreshed.data);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSend} className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Compose</p>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as "email" | "sms")}
              className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-2 text-sm text-ink"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={channel === "email" ? "owner@example.com" : "+15551234567"}
              className="flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-paper px-3 py-2 text-sm text-ink"
            />
          </div>
          {channel === "email" && (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-3 py-2 text-sm text-ink"
            />
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Message"
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={isPending || !recipient.trim() || !body.trim()}
            className="w-fit rounded-[var(--radius-sm)] bg-verified px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
        {result && (
          <p className={`mt-3 text-xs ${result.ok ? "text-voice-dark" : "text-danger"}`}>{result.message}</p>
        )}
      </form>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">History</p>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No messages sent yet.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-3.5"
              >
                <div>
                  <p className="text-sm text-ink">
                    {h.channel === "email" ? "✉️" : "📱"} {h.recipientMasked}
                  </p>
                  <p className="text-[11px] text-slate">
                    {h.templateType} · {new Date(h.createdAt).toLocaleString()}
                    {h.failureReason ? ` · ${h.failureReason}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    STATUS_TONE[h.status] ?? STATUS_TONE.unknown
                  }`}
                >
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
