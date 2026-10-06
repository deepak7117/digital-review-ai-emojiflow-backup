import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedbackFlow } from "@/components/feedback/FeedbackFlow";
import { Logo } from "@/components/ui/Logo";
import { BanaoAttribution } from "@/components/ui/BanaoAttribution";

export default async function PublicFeedbackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // This queries public.feedback_pages — a view granted to the anon role
  // that exposes only business_name/category/city/logo_url/google_review_url
  // and the link's tags/is_active. Nothing else about the business (phone,
  // email, address, website, owner_id, internal id) is reachable this way.
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("feedback_pages")
    .select("public_code, tags, is_active, business_name, category, city, logo_url, google_review_url")
    .eq("public_code", code)
    .maybeSingle();

  if (!page || !page.is_active) {
    notFound();
  }

  // public.feedback_page_questions — the up-to-2 active context questions
  // for this business, keyed by the same public_code. Same narrow-view
  // pattern as feedback_pages above.
  const { data: questions } = await supabase
    .from("feedback_page_questions")
    .select("question_id, question_text, options, sort_order")
    .eq("public_code", code)
    .order("sort_order", { ascending: true });

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-border/70 px-6 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <Logo compact />
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-lg">
          <FeedbackFlow
            code={page.public_code}
            businessName={page.business_name}
            category={page.category}
            city={page.city}
            logoUrl={page.logo_url}
            tags={page.tags}
            questions={(questions ?? []).map((q) => ({
              id: q.question_id,
              questionText: q.question_text,
              options: q.options,
            }))}
          />
        </div>
      </main>
      <footer className="px-6 py-6 text-center">
        <BanaoAttribution />
      </footer>
    </div>
  );
}
