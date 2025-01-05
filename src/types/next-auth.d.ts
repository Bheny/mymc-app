// src/types/next-auth.d.ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      mcName?: string | null;
    };
  }

  interface JWT {
    id: string; // Add this if you are using `id` in your JWT as well
    mcName?: string | null;
  }

  
}
