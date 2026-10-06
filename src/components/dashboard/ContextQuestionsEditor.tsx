"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import {
  createContextQuestion,
  updateContextQuestion,
  deleteContextQuestion,
  swapQuestionOrder,
  type ContextQuestion,
} from "@/app/dashboard/profile/questionsActions";

const MAX_ACTIVE = 2;

function QuestionCard({
  question,
  onSaved,
  onDeleted,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  question: ContextQuestion;
  onSaved: (q: ContextQuestion) => void;
  onDeleted: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(question.questionText);
  const [options, setOptions] = useState(question.options);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSave() {
    setError(null);
    setSaving(true);
    const result = await updateContextQuestion(question.id, { questionText: text, options });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
  }

  async function handleToggleActive() {
    setError(null);
    setSaving(true);
    const result = await updateContextQuestion(question.id, { isActive: !question.isActive });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
  }

  async function handleDelete() {
    setError(null);
    setSaving(true);
    const result = await deleteContextQuestion(question.id);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onDeleted(question.id);
  }

  return (
    <div className="rounded-lg border border-border-strong bg-paper p-4">
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={200}
        placeholder="Question text"
      />
      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              maxLength={60}
              placeholder={`Option ${i + 1}`}
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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleSave} loading={saving} disabled={disabled}>
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={handleToggleActive} loading={saving}>
          {question.isActive ? "Deactivate" : "Activate"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onMoveUp} disabled={!canMoveUp || saving}>
          Move up
        </Button>
        <Button size="sm" variant="ghost" onClick={onMoveDown} disabled={!canMoveDown || saving}>
          Move down
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDelete} loading={saving}>
          Delete
        </Button>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            question.isActive ? "bg-verified-tint text-verified-dark" : "bg-ink/5 text-slate"
          }`}
        >
          {question.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

export function ContextQuestionsEditor({ initialQuestions }: { initialQuestions: ContextQuestion[] }) {
  const [questions, setQuestions] = useState(
    [...initialQuestions].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeCount = questions.filter((q) => q.isActive).length;

  function replaceQuestion(updated: ContextQuestion) {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function handleAdd() {
    setError(null);
    setCreating(true);
    const result = await createContextQuestion("New question", ["Yes", "No"]);
    setCreating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setQuestions((prev) => [...prev, result.data]);
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const index = questions.findIndex((q) => q.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;

    setError(null);
    const result = await swapQuestionOrder(questions[index].id, questions[swapIndex].id);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setQuestions((prev) => {
      const next = [...prev];
      const tmp = next[index].sortOrder;
      next[index] = { ...next[index], sortOrder: next[swapIndex].sortOrder };
      next[swapIndex] = { ...next[swapIndex], sortOrder: tmp };
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
        Customer context questions
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate">
        Up to {MAX_ACTIVE} active questions customers see and answer alongside their feedback.
        Only you can add, edit, remove, reorder, or enable/disable these — customers can only
        answer them.
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            onSaved={replaceQuestion}
            onDeleted={removeQuestion}
            canMoveUp={i > 0}
            canMoveDown={i < questions.length - 1}
            onMoveUp={() => handleMove(q.id, "up")}
            onMoveDown={() => handleMove(q.id, "down")}
            disabled={false}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={handleAdd} loading={creating}>
          Add question
        </Button>
        <span className="text-xs text-slate">
          {activeCount}/{MAX_ACTIVE} active
        </span>
      </div>
    </div>
  );
}
