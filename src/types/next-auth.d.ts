import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:                 string;
      name?:              string | null;
      email?:             string | null;
      image?:             string | null;
      role?:              string | null;
      mustChangePassword: boolean;
      // Scope IDs matching UserRole
      branchId?:     string | null;
      mcId?:         string | null;
      buscentreId?:  string | null;
      cellId?:       string | null;
      shepherdId?:   string | null;
      // Acting-up views
      actingAs?:     string[];
      actingAt?:     Record<string, string>;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:                 string;
    role?:              string | null;
    mustChangePassword: boolean;
    branchId?:          string | null;
    mcId?:              string | null;
    buscentreId?:       string | null;
    cellId?:            string | null;
    shepherdId?:        string | null;
    actingAs?:          string[];
    actingAt?:          Record<string, string>;
  }
}
