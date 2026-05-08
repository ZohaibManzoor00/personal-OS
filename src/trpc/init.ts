import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import { auth } from "@/lib/auth";

export const createTRPCContext = cache(() => ({}));

const t = initTRPC.create({ transformer: superjson });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });

  return next({
    ctx: {
      ...ctx,
      session,
    },
  });
});
