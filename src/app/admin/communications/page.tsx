import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/permissions";
import { listCommunicationHistory } from "@/app/admin/communicationActions";
import { CommunicationCenter } from "@/components/admin/CommunicationCenter";

export default async function AdminCommunicationsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "super_admin") notFound();

  const result = await listCommunicationHistory();
  const history = "data" in result ? result.data : [];

  const providerConfigured = Boolean(process.env.EMAIL_PROVIDER_API_KEY || process.env.SMS_PROVIDER_API_KEY);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink sm:text-3xl">
        Communications
      </h1>
      <p className="mt-1 text-sm text-ink-soft">Admin-initiated email and SMS to owners, with real send history.</p>

      {!providerConfigured && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-gold/25 bg-gold-tint p-4 text-sm text-ink">
          No email or SMS provider is configured in this environment. Messages can be composed and recorded, but
          nothing will actually be delivered until a real provider is configured (see{" "}
          <code className="font-mono text-xs">src/lib/communication/provider.ts</code> for the exact environment
          variables required).
        </div>
      )}

      <div className="mt-6">
        <CommunicationCenter initialHistory={history} />
      </div>
    </div>
  );
}
