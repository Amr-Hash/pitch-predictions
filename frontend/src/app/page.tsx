import { Suspense } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ScoringRulesSection } from "@/components/ScoringRulesSection";
import HomeContent from "./HomeContent";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      <Suspense fallback={<LoadingScreen className="py-16" />}>
        <HomeContent />
      </Suspense>
      {/* Outside useSearchParams Suspense so scoring SSRs for logged-out visitors */}
      <ScoringRulesSection className="mt-16 w-full max-w-4xl text-left" />
    </div>
  );
}
