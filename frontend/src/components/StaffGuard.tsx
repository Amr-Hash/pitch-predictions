"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { isStaff, isStaffAllowedPath, isStaffSession } from "@/lib/staff";

export function StaffGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const staffSession = isStaffSession(user, loading);
  const staffBlocked = staffSession && !isStaffAllowedPath(pathname);

  useEffect(() => {
    if (staffBlocked) {
      router.replace("/admin");
    }
  }, [staffBlocked, router]);

  if (staffBlocked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
        Redirecting to admin...
      </div>
    );
  }

  return <>{children}</>;
}
