import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages:   { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where:   { email: parsed.data.email },
          include: { role: true },
        });

        if (!user || !user.password || !user.isActive) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        return {
          id:                user.id,
          email:             user.email,
          name:              user.name,
          role:              user.role?.role ?? null,
          mustChangePassword: user.mustChangePassword,
          // Primary scope IDs
          branchId:    user.role?.branchId    ?? null,
          mcId:        user.role?.mcId         ?? null,
          buscentreId: user.role?.buscentreId  ?? null,
          cellId:      user.role?.cellId       ?? null,
          shepherdId:  user.role?.shepherdId   ?? null,
          // Acting-up: roles and scope this user is temporarily filling
          actingAs: (user.role?.actingAs ?? []) as string[],
          actingAt: (user.role?.actingAt ?? {}) as Record<string, string>,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          role?:              string | null;
          mustChangePassword?: boolean;
          branchId?:          string | null;
          mcId?:              string | null;
          buscentreId?:       string | null;
          cellId?:            string | null;
          shepherdId?:        string | null;
          actingAs?:          string[];
          actingAt?:          Record<string, string>;
        };
        token.id                = u.id;
        token.role              = u.role;
        token.mustChangePassword = u.mustChangePassword ?? true;
        token.branchId          = u.branchId;
        token.mcId              = u.mcId;
        token.buscentreId       = u.buscentreId;
        token.cellId            = u.cellId;
        token.shepherdId        = u.shepherdId;
        token.actingAs          = u.actingAs ?? [];
        token.actingAt          = u.actingAt ?? {};
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id                 = token.id as string;
      session.user.role               = token.role as string | null;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      session.user.branchId           = token.branchId as string | null;
      session.user.mcId               = token.mcId as string | null;
      session.user.buscentreId        = token.buscentreId as string | null;
      session.user.cellId             = token.cellId     as string | null;
      session.user.shepherdId         = token.shepherdId as string | null;
      session.user.actingAs           = token.actingAs   as string[];
      session.user.actingAt           = token.actingAt   as Record<string, string>;
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
