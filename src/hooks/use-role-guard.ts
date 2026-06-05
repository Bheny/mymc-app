"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActiveRole } from "./use-active-role";

const ROLE_HOME: Record<string, string> = {
  admin:          "/",
  chief_shepherd: "/",
  mc_pastor:      "/",
  buscentre_head: "/buscentre",
  cell_shepherd:  "/cell",
  shepherd:       "/",
};

/**
 * Waits for the acting-roles fetch to settle, then:
 * - redirects if the active role is not in `allowedRoles`
 *
 * Returns `{ isLoading: true }` while the role is still being resolved so
 * pages can render a skeleton instead of role-specific content during that window.
 */
export function useRoleGuard(allowedRoles: string[]): { isLoading: boolean } {
  const router              = useRouter();
  const { data: session }   = useSession();
  const { activeView, ready } = useActiveRole();

  const role = activeView?.role ?? session?.user?.role ?? null;

  useEffect(() => {
    if (!ready || !role) return;
    if (!allowedRoles.includes(role)) {
      router.replace(ROLE_HOME[role] ?? "/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, role]);

  // isLoading = true until the fetch has settled AND the role is confirmed valid
  return { isLoading: !ready || !role };
}
