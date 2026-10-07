import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedbackFlow } from "@/components/feedback/FeedbackFlow";
import { Logo } from "@/components/ui/Logo";
import { BanaoAttribution } from "@/components/ui/BanaoAttribution";
import { getTheme, themeCssVars } from "@/lib/branding/themes";

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
    .select(
      "public_code, tags, is_active, business_name, category, city, logo_url, google_review_url, brand_theme"
    )
    .eq("public_code", code)
    .maybeSingle();

  if (!page || !page.is_active) {
    notFound();
  }

  // Settings > Brand & Experience — a curated theme preset, not a free
  // color picker (see src/lib/branding/themes.ts). Applied as inline CSS
  // variable overrides scoped to this page only; every existing
  // bg-verified/text-verified-dark/var(--gradient-brand) usage already
  // throughout FeedbackFlow.tsx picks this up automatically — zero
  // changes needed there.
  const theme = getTheme(page.brand_theme);

  // public.feedback_page_questions — the up-to-2 active context questions
  // for this business, keyed by the same public_code. Same narrow-view
  // pattern as feedback_pages above.
  const { data: questions } = await supabase
    .from("feedback_page_questions")
    .select("question_id, question_text, options, sort_order")
    .eq("public_code", code)
    .order("sort_order", { ascending: true });

  return (
    <div className="flex min-h-screen flex-col bg-canvas" style={themeCssVars(theme)}>
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
