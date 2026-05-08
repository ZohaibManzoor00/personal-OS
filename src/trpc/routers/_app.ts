import { prisma } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  getUsers: protectedProcedure.query(async ({ ctx }) => {
    console.log({ userId: ctx.session.user.id, email: ctx.session.user.email });
    const users = await prisma.user.findMany();
    return users;
  }),
});

export type AppRouter = typeof appRouter;
