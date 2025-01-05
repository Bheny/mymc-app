import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Mock function for fetching users from a database
const fetchUserByEmail = async (email: string) => {
  // Replace with real database logic
  const users = [
    {
      id: "1",
      name: "admin",
      email: "admin@example.com",
      password: await bcrypt.hash("password123", 10),
      mcName: "DUNAMIS",
    },
    {
      id: "2",
      name: "Favour",
      email: "favour@example.com",
      password: await bcrypt.hash("password123", 10),
      mcName: "AGAPE",
    },
  ];
  return users.find((user) => user.email === email);
};

const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        const user = await fetchUserByEmail(credentials.email);

        if (!user) {
          throw new Error("User not found.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid credentials.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          mcName: user.mcName,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login", // Customize sign-in page
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // token.mcName = user.mcName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // session.user.mcName = token.mcName as string;
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development", // Enable debugging in development
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
