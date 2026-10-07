import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusinessProfileForm, type BusinessProfileData } from "@/components/dashboard/BusinessProfileForm";
import { isGooglePlacesConfigured } from "@/lib/google/placesLookup";
import { ContextQuestionsEditor } from "@/components/dashboard/ContextQuestionsEditor";
import { listContextQuestions } from "@/app/dashboard/profile/questionsActions";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

export default async function BusinessProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { business } = await getActiveBusiness(supabase);

  const initialData: BusinessProfileData | null = business
    ? {
        business_name: business.business_name ?? "",
        category: business.category ?? "",
        phone: business.phone ?? "",
        email: business.email ?? "",
        address: business.address ?? "",
        city: business.city ?? "",
        website: business.website ?? "",
        google_review_url: business.google_review_url ?? "",
        industry_slug: business.industry_slug ?? "",
        segment_slug: business.segment_slug ?? "",
      }
    : null;

  const questionsResult = business ? await listContextQuestions() : null;
  const contextQuestions = questionsResult && "data" in questionsResult ? questionsResult.data : [];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Business Profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        This information will be used across your QR feedback flow and reviews in later modules.
      </p>
      <div className="mt-6">
        <BusinessProfileForm
          initialData={initialData}
          hasExistingRecord={!!business}
          businessId={business?.id ?? null}
          googlePlacesConfigured={isGooglePlacesConfigured()}
        />
      </div>

      {business && (
        <div className="mt-6">
          <ContextQuestionsEditor initialQuestions={contextQuestions} />
        </div>
      )}
    </div>
  );
}
