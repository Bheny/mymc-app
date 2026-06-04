"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActiveRole } from "./use-active-role";

// Where each role lands when redirected away from an unauthorized page
const ROLE_HOME: Record<string, string> = {
  admin:          "/",
  chief_shepherd: "/",
  mc_pastor:      "/",
  buscentre_head: "/buscentre",
  cell_shepherd:  "/cell",
  shepherd:       "/",
};

/**
 * Redirects to the role's home page if the current active role is not in
 * `allowedRoles`. Waits for the acting-roles fetch to settle before acting
 * so it never fires on a stale primary-role snapshot.
 */
export function useRoleGuard(allowedRoles: string[]) {
  const router              = useRouter();
  const { data: session }   = useSession();
  const { activeView, ready } = useActiveRole();

  const role = activeView?.role ?? session?.user?.role ?? null;

  useEffect(() => {
    // Don't redirect until the acting-roles fetch has settled
    if (!ready || !role) return;
    if (!allowedRoles.includes(role)) {
      router.replace(ROLE_HOME[role] ?? "/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, role]);
}
