"use client";

import { useState, useTransition } from "react";
import { enrollMfaFactor, verifyMfaEnrollment, unenrollOwnMfaFactor, type MfaFactor } from "@/app/admin/mfaActions";

export function MfaEnrollmentPanel({ initialFactors }: { initialFactors: MfaFactor[] }) {
  const [factors, setFactors] = useState(initialFactors);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const verifiedFactor = factors.find((f) => f.status === "verified");

  function handleEnroll() {
    setError(null);
    startTransition(async () => {
      const result = await enrollMfaFactor();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEnrolling(result.data);
    });
  }

  function handleVerify() {
    if (!enrolling) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyMfaEnrollment(enrolling.factorId, code);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFactors((prev) => [...prev, { id: enrolling.factorId, status: "verified", createdAt: new Date().toISOString() }]);
      setEnrolling(null);
      setCode("");
    });
  }

  function handleUnenroll(factorId: string) {
    setError(null);
    startTransition(async () => {
      const result = await unenrollOwnMfaFactor(factorId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFactors((prev) => prev.filter((f) => f.id !== factorId));
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {verifiedFactor ? (
        <div>
          <p className="text-sm text-ink">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success" />
            Two-factor authentication is enabled.
          </p>
          <button
            type="button"
            onClick={() => handleUnenroll(verifiedFactor.id)}
            disabled={isPending}
            className="mt-3 rounded-[var(--radius-sm)] border border-border-strong px-3 py-1.5 text-xs font-medium text-danger disabled:opacity-50"
          >
            Remove two-factor authentication
          </button>
        </div>
      ) : enrolling ? (
        <div>
          <p className="text-sm text-ink">Scan this code with your authenticator app:</p>
          {/* Supabase returns an inline SVG data URI for the QR code */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qrCode} alt="MFA enrollment QR code" className="mt-3 h-40 w-40" />
          <p className="mt-2 text-xs text-slate">
            Or enter this key manually: <span className="font-mono">{enrolling.secret}</span>
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="w-32 rounded-[var(--radius-sm)] border border-border-strong bg-paper px-3 py-2 text-sm text-ink"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={isPending || code.length !== 6}
              className="rounded-[var(--radius-sm)] bg-verified px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Verify &amp; Enable
            </button>
            <button
              type="button"
              onClick={() => {
                setEnrolling(null);
                setCode("");
              }}
              disabled={isPending}
              className="rounded-[var(--radius-sm)] border border-border-strong px-3 py-2 text-xs text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-ink-soft">
            Two-factor authentication is not enabled for your account.
          </p>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={isPending}
            className="mt-3 rounded-[var(--radius-sm)] bg-verified px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Set Up Two-Factor Authentication
          </button>
        </div>
      )}
    </div>
  );
}
