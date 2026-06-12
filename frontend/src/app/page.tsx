import { Suspense } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import HomeContent from "./HomeContent";

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingScreen className="py-16" />}>
      <HomeContent />
    </Suspense>
  );
}
