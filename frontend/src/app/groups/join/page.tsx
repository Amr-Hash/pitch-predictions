import { Suspense } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import JoinGroupContent from "./JoinGroupContent";

export default function JoinGroupPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <JoinGroupContent />
    </Suspense>
  );
}
