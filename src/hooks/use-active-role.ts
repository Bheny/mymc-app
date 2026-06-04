"use client";

import {
  createContext, useContext, useEffect, useState, useCallback, createElement,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export type RoleView = {
  key:          string;
  role:         string;
  isActing:     boolean;
  scopeType?:   string;
  scopeId?:     string;
  cellId?:      string | null;
  buscentreId?: string | null;
  mcId?:        string | null;
  branchId?:    string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin:          "Admin",
  chief_shepherd: "Chief Shepherd",
  mc_pastor:      "MC Pastor",
  buscentre_head: "Buscentre Head",
  cell_shepherd:  "Cell Shepherd",
  shepherd:       "Shepherd",
};

const ACTING_SCOPE_KEY: Record<string, string> = {
  cell_shepherd:  "cell_id",
  buscentre_head: "buscentre_id",
  mc_pastor:      "mc_id",
  chief_shepherd: "branch_id",
};

export function roleLabel(role: string, isActing = false): string {
  const base = ROLE_LABELS[role] ?? role.replace(/_/g, " ");
  return isActing ? `${base} (acting)` : base;
}

// ─── Context ──────────────────────────────────────────────────────────────────

type ActiveRoleContextValue = {
  allViews:         RoleView[];
  activeView:       RoleView | null;
  switchToView:     (key: string) => void;
  removeActing:     (view: RoleView) => Promise<void>;
  hasMultipleViews: boolean;
  roleLabel:        typeof roleLabel;
  refreshActing:    () => void;
  /** True once the first /api/me/acting fetch has settled — safe to use for route guards */
  ready:            boolean;
};

const ActiveRoleContext = createContext<ActiveRoleContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [actingAs, setActingAs] = useState<string[]>([]);
  const [actingAt, setActingAt] = useState<Record<string, string>>({});
  const [ready,    setReady]    = useState(false);

  const fetchActing = useCallback(() => {
    if (!userId) return;
    fetch("/api/me/acting")
      .then((r) => r.json())
      .then((d) => {
        setActingAs(d.actingAs ?? []);
        setActingAt(d.actingAt ?? {});
        setReady(true);
      })
      .catch(() => { setReady(true); });
  }, [userId]);

  useEffect(() => {
    fetchActing();

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchActing();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchActing);
    const poll = setInterval(fetchActing, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchActing);
      clearInterval(poll);
    };
  }, [fetchActing]);

  // ── Build views ─────────────────────────────────────────────────────────────

  const primaryView: RoleView | null = session?.user?.role
    ? {
        key:         "primary",
        role:        session.user.role,
        isActing:    false,
        cellId:      session.user.cellId      ?? null,
        buscentreId: session.user.buscentreId ?? null,
        mcId:        session.user.mcId        ?? null,
        branchId:    session.user.branchId    ?? null,
      }
    : null;

  const actingViews: RoleView[] = actingAs.map((role, i) => {
    const scopeKey  = ACTING_SCOPE_KEY[role];
    const scopeId   = scopeKey ? actingAt[scopeKey] : undefined;
    const scopeType = scopeKey?.replace("_id", "");
    return {
      key:         `acting_${i}_${role}`,
      role,
      isActing:    true,
      scopeType,
      scopeId,
      cellId:      role === "cell_shepherd"  ? (scopeId ?? null) : null,
      buscentreId: role === "buscentre_head" ? (scopeId ?? null) : null,
      mcId:        role === "mc_pastor"      ? (scopeId ?? null) : null,
      branchId:    role === "chief_shepherd" ? (scopeId ?? null) : null,
    };
  });

  const allViews: RoleView[] = primaryView ? [primaryView, ...actingViews] : actingViews;

  // ── Persist active key in localStorage ──────────────────────────────────────

  const storageKey = userId ? `mymc_active_role_${userId}` : null;
  const [activeKey, setActiveKey] = useState<string>("primary");

  useEffect(() => {
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (stored && allViews.find((v) => v.key === stored)) {
      setActiveKey(stored);
    } else {
      setActiveKey("primary");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, actingAs.length]);

  const switchToView = useCallback(
    (key: string) => {
      setActiveKey(key);
      if (storageKey) localStorage.setItem(storageKey, key);
    },
    [storageKey]
  );

  const activeView = allViews.find((v) => v.key === activeKey) ?? primaryView;

  const removeActing = useCallback(async (view: RoleView) => {
    if (!view.isActing || !userId) return;
    await fetch("/api/org/acting", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, actingAs: view.role, nodeId: view.scopeId ?? "" }),
    });
    if (activeKey === view.key) switchToView("primary");
    fetchActing();
  }, [userId, activeKey, switchToView, fetchActing]);

  const value: ActiveRoleContextValue = {
    allViews,
    activeView,
    switchToView,
    removeActing,
    hasMultipleViews: allViews.length > 1,
    roleLabel,
    refreshActing: fetchActing,
    ready,
  };

  return createElement(ActiveRoleContext.Provider, { value }, children);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActiveRole(): ActiveRoleContextValue {
  const ctx = useContext(ActiveRoleContext);
  if (!ctx) throw new Error("useActiveRole must be used inside <ActiveRoleProvider>");
  return ctx;
}
