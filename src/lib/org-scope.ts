// Permission checks for creating new nodes in the org hierarchy
// (Branch → MegaChurch → Buscentre → Cell). A node can only be created by
// someone whose scope already covers its intended parent.

type ScopeUser = {
  role?:        string | null;
  branchId?:    string | null;
  mcId?:        string | null;
  buscentreId?: string | null;
};

export function canCreateMc(user: ScopeUser, branchId: string): boolean {
  switch (user.role) {
    case "admin":          return true;
    case "chief_shepherd": return user.branchId === branchId;
    default:               return false;
  }
}

export function canCreateBuscentre(user: ScopeUser, mc: { id: string; branchId: string }): boolean {
  switch (user.role) {
    case "admin":          return true;
    case "chief_shepherd": return user.branchId === mc.branchId;
    case "mc_pastor":      return user.mcId === mc.id;
    default:               return false;
  }
}

export function canCreateCell(
  user: ScopeUser,
  buscentre: { id: string; mcId: string; mc: { branchId: string } }
): boolean {
  switch (user.role) {
    case "admin":          return true;
    case "chief_shepherd": return user.branchId === buscentre.mc.branchId;
    case "mc_pastor":      return user.mcId === buscentre.mcId;
    case "buscentre_head": return user.buscentreId === buscentre.id;
    default:               return false;
  }
}
