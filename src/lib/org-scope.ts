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

// Moving a cell needs authority over both the source and destination buscentre
export function canMoveCell(
  user: ScopeUser,
  from: { mcId: string; mc: { branchId: string } },
  to:   { mcId: string; mc: { branchId: string } }
): boolean {
  switch (user.role) {
    case "admin":          return true;
    case "chief_shepherd": return user.branchId === from.mc.branchId && user.branchId === to.mc.branchId;
    case "mc_pastor":      return user.mcId === from.mcId && user.mcId === to.mcId;
    default:               return false;
  }
}

// Moving a buscentre between MCs needs authority over both MCs — so not an MC pastor
export function canMoveBuscentre(
  user: ScopeUser,
  from: { branchId: string },
  to:   { branchId: string }
): boolean {
  switch (user.role) {
    case "admin":          return true;
    case "chief_shepherd": return user.branchId === from.branchId && user.branchId === to.branchId;
    default:               return false;
  }
}

export function canManageDepartments(user: ScopeUser, branchId: string): boolean {
  switch (user.role) {
    case "admin":          return true;
    case "chief_shepherd": return user.branchId === branchId;
    default:               return false;
  }
}
