"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { THEME_LIST, getTheme, type ThemeId } from "@/lib/branding/themes";
import { updateBrandSettings } from "@/app/dashboard/settings/actions";

export function BrandSettingsForm({
  businessName,
  initialLogoUrl,
  initialThemeId,
}: {
  businessName: string;
  initialLogoUrl: string | null;
  initialThemeId: string;
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [themeId, setThemeId] = useState<ThemeId>(getTheme(initialThemeId).id);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty = logoUrl !== (initialLogoUrl ?? "") || themeId !== getTheme(initialThemeId).id;
  const theme = getTheme(themeId);

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    setErrorMessage(null);
    const result = await updateBrandSettings(logoUrl, themeId);
    setSaving(false);
    if ("error" in result) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }
    setStatus("saved");
  }

  function handleReset() {
    setLogoUrl(initialLogoUrl ?? "");
    setThemeId(getTheme(initialThemeId).id);
    setStatus("idle");
    setErrorMessage(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        {/* Logo — plain URL, not an upload. Honest about the limitation
            rather than faking a file picker with nothing behind it. */}
        <div className="rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-5 shadow-sm">
          <p className="font-display text-base font-semibold text-ink">Logo</p>
          <p className="mt-1 text-xs text-slate">
            Paste a link to your logo image. Direct logo upload will be available soon.
          </p>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              setStatus("idle");
            }}
            placeholder="https://example.com/logo.png"
            className="mt-3 w-full rounded-[var(--radius-sm)] border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink shadow-xs placeholder:text-slate/70 focus:outline-none focus:ring-4 focus:ring-verified/15"
          />
        </div>

        {/* Theme — curated set only, per the approved design constraint. */}
        <div className="rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-5 shadow-sm">
          <p className="font-display text-base font-semibold text-ink">Accent theme</p>
          <p className="mt-1 text-xs text-slate">
            Choose how your customer experience looks. Applied immediately for new feedback visits.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {THEME_LIST.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setThemeId(t.id);
                  setStatus("idle");
                }}
                className={`flex flex-col items-center gap-2 rounded-[var(--radius-md)] border-2 p-3 transition-all ${
                  themeId === t.id
                    ? "border-ink shadow-sm"
                    : "border-border-strong hover:border-ink/30"
                }`}
              >
                <span
                  className="h-8 w-8 rounded-full shadow-sm"
                  style={{ background: t.gradient }}
                  aria-hidden="true"
                />
                <span className="text-center text-xs font-medium text-ink-soft">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {status === "saved" && <Alert tone="success">Saved — your customer experience is updated.</Alert>}
        {status === "error" && errorMessage && <Alert tone="error">{errorMessage}</Alert>}

        <div className="flex gap-2">
          <Button onClick={handleSave} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={handleReset} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Live preview — same component/token language as the real
          customer experience (gradient avatar, emoji row, primary
          button), scaled down, so the owner never selects a theme
          blindly. */}
      <div className="rounded-[var(--radius-lg)] border border-border-strong bg-canvas p-5 shadow-sm">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-slate">Preview</p>
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 text-center shadow-md">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mx-auto h-12 w-12 rounded-full object-cover shadow-sm ring-2 ring-paper-raised"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
              style={{ background: theme.gradient }}
            >
              {businessName.charAt(0)}
            </div>
          )}
          <p className="mt-2 text-sm font-semibold text-ink">{businessName}</p>
          <p className="mt-2 text-xs text-ink-soft">How was your experience?</p>
          <div className="mt-2 flex justify-center gap-1 text-lg">
            <span>😡</span>
            <span>😐</span>
            <span style={{ filter: "drop-shadow(0 0 0 transparent)" }}>🤩</span>
          </div>
          <button
            type="button"
            disabled
            className="mt-3 w-full rounded-[var(--radius-sm)] px-4 py-2 text-xs font-medium text-white shadow-sm"
            style={{ background: theme.accent }}
          >
            Continue to Google →
          </button>
        </div>
      </div>
    </div>
  );
}
