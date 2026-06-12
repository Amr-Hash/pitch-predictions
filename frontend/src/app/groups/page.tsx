import { Suspense } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import GroupsContent from "./GroupsContent";

export default function GroupsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GroupsContent />
    </Suspense>
  );
}
