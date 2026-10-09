import { listMfaFactors } from "@/app/admin/mfaActions";
import { MfaEnrollmentPanel } from "@/components/admin/MfaEnrollmentPanel";

export default async function AdminSecurityPage() {
  const result = await listMfaFactors();
  const factors = "data" in result ? result.data : [];
  const loadError = "error" in result ? result.error : null;

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink sm:text-3xl">
        Account Security
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Two-factor authentication using an authenticator app — no SMS or email required.
      </p>

      <div className="mt-6">
        {loadError ? (
          <p className="rounded-[var(--radius-md)] border border-danger/20 bg-danger-tint p-4 text-sm text-danger">
            {loadError}
          </p>
        ) : (
          <MfaEnrollmentPanel initialFactors={factors} />
        )}
      </div>

      <p className="mt-6 text-xs text-slate">
        Lost your authenticator? Ask another Super Admin to use the MFA recovery action for your account.
      </p>
    </div>
  );
}
