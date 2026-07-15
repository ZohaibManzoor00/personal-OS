import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOwnerEmail, OWNER_EMAIL } from "@/lib/owner";
import { polarClient } from "@/lib/polar";

export const createTRPCContext = cache(async () => {});
const t = initTRPC.create({ transformer: superjson });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

/**
 * The owner's user id — the single account whose content the app serves
 * publicly. Cached per request. `null` when the owner account doesn't exist yet
 * (in which case reads return nothing rather than erroring).
 */
export const getOwnerUserId = cache(async (): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });
  return user?.id ?? null;
});

/**
 * Base for readable data. Anyone — signed in or not — may call it. It resolves
 * the viewer's session, whether they're the owner, and whose content to serve
 * (`ownerUserId`). Reads are scoped to the owner's account so the whole app is a
 * read-only showcase until the owner signs in.
 */
export const publicProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = isOwnerEmail(session?.user.email);
  const ownerUserId = await getOwnerUserId();

  return next({ ctx: { ...ctx, session, isOwner, ownerUserId } });
});

/** Writes and personal data — only the owner may call these. */
export const ownerProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.isOwner) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Owner only" });
  }

  return next({ ctx: { ...ctx, auth: ctx.session } });
});

/**
 * Any authenticated user (not necessarily the owner). Kept for future
 * multi-tenant features; not used by the showcase reads/writes today.
 */
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });

  return next({ ctx: { ...ctx, auth: session } });
});

export const premiumProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const customer = await polarClient.customers.getStateExternal({ externalId: ctx.auth.user.id });

  if (!customer.activeSubscriptions || customer.activeSubscriptions.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Active subscription required" });
  }

  return next({ ctx: { ...ctx, customer } });
});
