import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PulseVoteFlow } from "@/components/pulse/PulseVoteFlow";
import { Logo } from "@/components/ui/Logo";

export default async function PublicPulsePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const supabase = await createClient();
  const { data: poll } = await supabase
    .from("customer_pulse_pages")
    .select("public_code, question, options, is_active, business_name, logo_url")
    .eq("public_code", code)
    .maybeSingle();

  if (!poll || !poll.is_active) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-border px-6 py-4">
        <Logo compact />
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <PulseVoteFlow
            code={poll.public_code}
            businessName={poll.business_name}
            logoUrl={poll.logo_url}
            question={poll.question}
            options={poll.options}
          />
        </div>
      </main>
    </div>
  );
}
