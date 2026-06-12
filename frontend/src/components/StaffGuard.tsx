"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { isStaff, isStaffAllowedPath } from "@/lib/staff";

export function StaffGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  const staffBlocked =
    !loading && Boolean(user && isStaff(user) && !isStaffAllowedPath(pathname));

  useEffect(() => {
    if (staffBlocked) {
      router.replace("/admin");
    }
  }, [staffBlocked, router]);

  if (staffBlocked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
        {t("redirectingToAdmin")}
      </div>
    );
  }

  return <>{children}</>;
}
