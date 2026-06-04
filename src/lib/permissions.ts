import { Role } from "@prisma/client";

// Which roles a given role is permitted to activate
const ACTIVATION_MATRIX: Record<Role, Role[]> = {
  admin:          ["chief_shepherd", "mc_pastor", "buscentre_head", "cell_shepherd", "shepherd"],
  chief_shepherd: ["mc_pastor", "buscentre_head", "cell_shepherd", "shepherd"],
  mc_pastor:      ["buscentre_head", "cell_shepherd", "shepherd"],
  buscentre_head: ["cell_shepherd", "shepherd"],
  cell_shepherd:  ["shepherd"],
  shepherd:       [],
};

export function canActivate(activatorRole: Role, targetRole: Role): boolean {
  return ACTIVATION_MATRIX[activatorRole]?.includes(targetRole) ?? false;
}

// Ordered from highest to lowest — used for severity calculations
export const ROLE_ORDER: Role[] = [
  "admin",
  "chief_shepherd",
  "mc_pastor",
  "buscentre_head",
  "cell_shepherd",
  "shepherd",
];

export function roleRank(role: Role): number {
  return ROLE_ORDER.indexOf(role);
}
