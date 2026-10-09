import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/business/activeBusiness";
import { listBranches, getBranchEntitlementSummary } from "@/app/dashboard/branches/actions";
import { BranchManager } from "@/components/dashboard/BranchManager";
import { getBanaoContactDestination } from "@/lib/config/contact";

export default async function BranchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { business } = await getActiveBusiness(supabase);
  if (!business) redirect("/dashboard/profile");

  const [branchesResult, entitlement] = await Promise.all([listBranches(), getBranchEntitlementSummary()]);
  const branches = "data" in branchesResult ? branchesResult.data : [];
  const contact = getBanaoContactDestination();

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Branches</h1>
      <p className="mt-1 text-sm text-ink-soft">{business.business_name} — locations and branches.</p>

      <div className="mt-6">
        <BranchManager
          initialBranches={branches}
          multiBranchEnabled={entitlement?.multiBranchEnabled ?? false}
          maxBranches={entitlement?.maxBranches ?? 1}
          currentActiveCount={entitlement?.currentActiveBranchCount ?? 0}
          contact={contact}
        />
      </div>
    </div>
  );
}
