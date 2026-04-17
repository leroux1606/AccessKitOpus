import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@accesskit.app",
      async sendVerificationRequest({ identifier, url }) {
        // Log to console ONLY in development — never in production, where
        // anyone with log access could sign in as any user.
        if (process.env.NODE_ENV !== "production") {
          console.log("\n========================================");
          console.log("MAGIC LINK FOR:", identifier);
          console.log(url);
          console.log("========================================\n");
        }

        try {
          const { Resend: ResendClient } = await import("resend");
          const resend = new ResendClient(process.env.RESEND_API_KEY ?? "");
          await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
            to: identifier,
            subject: "Sign in to AccessKit",
            html: `<p>Click to sign in: <a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`,
          });
        } catch (err) {
          console.error("Email send failed (use the console link above):", err);
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Automatically create a personal organization for new users
      if (!user.email || !user.id) return;

      const orgName = user.name ?? user.email.split("@")[0] ?? "My Organization";
      const baseSlug = slugify(orgName);

      // Ensure slug is unique
      let slug = baseSlug;
      let suffix = 0;
      while (true) {
        const existing = await db.organization.findUnique({ where: { slug } });
        if (!existing) break;
        suffix++;
        slug = `${baseSlug}-${suffix}`;
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const org = await db.organization.create({
        data: {
          name: orgName,
          slug,
          plan: "STARTER",
          subscriptionStatus: "TRIALING",
          trialEndsAt,
        },
      });

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "OWNER",
        },
      });
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify-request",
  },
});
