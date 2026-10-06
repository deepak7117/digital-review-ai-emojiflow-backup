"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { createPoll, setPollActive, type PollWithResults } from "@/app/dashboard/pulse/actions";
import type { PulseQuestionTemplate } from "@/lib/segments/types";

function PollResultsBar({ poll }: { poll: PollWithResults }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {poll.options.map((option, i) => {
        const count = poll.optionCounts[i] ?? 0;
        const pct = poll.totalResponses > 0 ? Math.round((count / poll.totalResponses) * 100) : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm text-ink-soft">{option}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-verified" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs text-slate">
              {count} ({pct}%)
            </span>
          </div>
        );
      })}
      <p className="mt-1 text-xs text-slate">
        {poll.totalResponses === 0
          ? "No responses yet"
          : `Among ${poll.totalResponses} response${poll.totalResponses === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

export function PulseManager({
  initialPolls,
  suggestedQuestions = [],
  segmentName = null,
}: {
  initialPolls: PollWithResults[];
  /** Segment-aware suggestions (Module 7 Milestone B) — empty for businesses with no segment selected, which behave exactly as before. */
  suggestedQuestions?: PulseQuestionTemplate[];
  segmentName?: string | null;
}) {
  const [polls, setPolls] = useState(initialPolls);
  const [showForm, setShowForm] = useState(initialPolls.length === 0);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    // window.location is only available client-side; this is exactly what
    // useEffect is for (syncing with a browser API unavailable during SSR),
    // same justified pattern as QrFeedbackPanel.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    if (options.length >= 4) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  /** Quick-fills the form from a segment-aware suggestion — the owner can still edit anything before creating. */
  function applySuggestion(template: PulseQuestionTemplate) {
    setQuestion(template.question);
    setOptions(template.options.slice(0, 4));
    setShowForm(true);
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    const result = await createPoll({ question, options });
    setCreating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPolls((prev) => [
      {
        id: result.data.publicCode,
        publicCode: result.data.publicCode,
        question,
        options: options.filter((o) => o.trim()),
        isActive: true,
        createdAt: new Date().toISOString(),
        totalResponses: 0,
        optionCounts: options.filter((o) => o.trim()).map(() => 0),
      },
      ...prev,
    ]);
    setQuestion("");
    setOptions(["", ""]);
    setShowForm(false);
  }

  async function handleToggle(poll: PollWithResults) {
    setTogglingId(poll.id);
    const result = await setPollActive(poll.id, !poll.isActive);
    setTogglingId(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPolls((prev) => prev.map((p) => (p.id === poll.id ? { ...p, isActive: !p.isActive } : p)));
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <Alert tone="error">{error}</Alert>}

      {showForm ? (
        <div className="rounded-xl border border-border-strong bg-paper-raised p-6">
          <p className="font-display text-sm font-semibold text-ink">New poll</p>

          {suggestedQuestions.length > 0 && (
            <div className="mt-3 rounded-md bg-paper p-3.5">
              <p className="text-xs font-medium text-ink-soft">
                Suggested for {segmentName ?? "your business type"}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {suggestedQuestions.map((template) => (
                  <button
                    key={template.question}
                    type="button"
                    onClick={() => applySuggestion(template)}
                    className="rounded-md border border-border-strong bg-paper-raised px-3 py-2 text-left text-xs text-ink-soft transition-colors hover:border-verified hover:text-ink"
                  >
                    {template.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-4">
            <Field label="Question" htmlFor="pulse-question" required>
              <Input
                id="pulse-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What should we bring next?"
                maxLength={200}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">Options (2–4)</label>
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={60}
                  />
                  {options.length > 2 && (
                    <Button size="sm" variant="ghost" onClick={() => removeOption(i)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 4 && (
                <Button size="sm" variant="secondary" onClick={addOption} className="w-fit">
                  Add option
                </Button>
              )}
            </div>
            <div className="flex justify-end gap-2">
              {initialPolls.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={handleCreate} loading={creating}>
                Create poll
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowForm(true)} className="w-fit">
          Create a new poll
        </Button>
      )}

      {polls.length === 0 && !showForm && (
        <p className="text-sm text-slate">No polls yet.</p>
      )}

      <ul className="flex flex-col gap-4">
        {polls.map((poll) => {
          const url = origin ? `${origin}/pulse/${poll.publicCode}` : `/pulse/${poll.publicCode}`;
          return (
            <li key={poll.id} className="rounded-xl border border-border-strong bg-paper-raised p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold text-ink">{poll.question}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate">{url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(poll)}
                  disabled={togglingId === poll.id}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    poll.isActive
                      ? "bg-verified-tint text-verified-dark"
                      : "bg-ink/5 text-slate"
                  }`}
                >
                  {poll.isActive ? "Active" : "Paused"}
                </button>
              </div>
              <PollResultsBar poll={poll} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
