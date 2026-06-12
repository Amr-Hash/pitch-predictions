import { Suspense } from "react";
import JoinGroupContent from "./JoinGroupContent";

function JoinFallback() {
  return <div className="text-center text-gray-500">Loading...</div>;
}

export default function JoinGroupPage() {
  return (
    <Suspense fallback={<JoinFallback />}>
      <JoinGroupContent />
    </Suspense>
  );
}
