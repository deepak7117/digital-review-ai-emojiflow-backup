import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { WhySection } from "@/components/landing/WhySection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <WhySection />
        <TrustSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
