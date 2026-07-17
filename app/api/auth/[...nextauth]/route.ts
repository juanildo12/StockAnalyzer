import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/src/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      try {
        // Upsert user in PostgreSQL
        await prisma.users.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            image: user.image,
          },
          create: {
            id: user.id!,
            email: user.email,
            name: user.name,
            image: user.image,
            emailVerified: new Date(),
          },
        });

        // Upsert account link
        if (account) {
          await prisma.accounts.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            update: {
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
            },
            create: {
              userId: user.id!,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
            },
          });
        }

        // Ensure subscription record exists
        await prisma.subscriptions.upsert({
          where: { userId: user.id! },
          update: {},
          create: {
            userId: user.id!,
            plan: "free",
            status: "active",
          },
        });
      } catch (err) {
        console.error("[Auth] signIn error:", err);
        // Allow sign-in even if DB save fails
      }

      return true;
    },
    async jwt({ token, user }) {
      // Admin bypass: specific emails get enterprise plan
      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
      const email = (token.email || user?.email || "").toLowerCase();
      if (adminEmails.includes(email)) {
        token.plan = "enterprise";
        return token;
      }

      // On first sign-in, populate plan from DB
      if (user) {
        const sub = await prisma.subscriptions.findUnique({
          where: { userId: user.id! },
          select: { plan: true },
        });
        token.plan = sub?.plan ?? "free";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        (session.user as any).plan = token.plan ?? "free";
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
