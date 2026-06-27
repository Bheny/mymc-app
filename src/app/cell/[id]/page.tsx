"use client";

import { CellDashboard } from "@/components/cell-dashboard";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { CELL_DASHBOARD_ROLES } from "@/lib/view-permissions";

export default function CellByIdPage({ params }: { params: { id: string } }) {
  const { isLoading } = useRoleGuard(CELL_DASHBOARD_ROLES);

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
        <div className="skeleton h-7 w-40 rounded mb-2" />
        <div className="skeleton h-4 w-56 rounded mb-8" />
      </div>
    );
  }

  return <CellDashboard cellId={params.id} />;
}
