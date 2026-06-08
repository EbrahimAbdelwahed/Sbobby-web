import GoogleProvider from "next-auth/providers/google";
import { getServerSession, type NextAuthOptions } from "next-auth";

import { ensureUser, userHasRole } from "@/lib/exam/repository";

if (!process.env.NEXTAUTH_URL && process.env.AUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL;
}

const BOOTSTRAP_ADMIN_EMAILS = ["ebrahim.abdelwahed01@universitadipavia.it"];

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: requiredEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.providerAccountId) {
        token.sub = account.providerAccountId;
      }
      if (profile && "email" in profile && typeof profile.email === "string") {
        token.email = profile.email;
      }
      return token;
    },
    async session({ session, token }) {
      const email = session.user?.email ?? token.email;
      const id = email ?? token.sub;
      if (session.user && id && email) {
        (session.user as SessionUser).id = String(id);
        session.user.email = String(email);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as Partial<SessionUser> | undefined;
  if (!user?.email) {
    return null;
  }
  const authUser = {
    id: user.id ?? user.email,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
  };
  await ensureUser(authUser);
  return authUser;
}

function isBootstrapAdmin(user: SessionUser | null) {
  if (!user?.email) {
    return false;
  }
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...allowlist, ...BOOTSTRAP_ADMIN_EMAILS].includes(user.email.toLowerCase());
}

export async function isAdminUser(user: SessionUser | null) {
  if (!user?.email) {
    return false;
  }
  if (await userHasRole(user.email, "admin")) {
    return true;
  }
  return isBootstrapAdmin(user);
}
