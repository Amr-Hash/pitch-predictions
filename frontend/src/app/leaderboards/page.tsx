import { Suspense } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import LeaderboardsContent from "./LeaderboardsContent";

export default function LeaderboardsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LeaderboardsContent />
    </Suspense>
  );
}
