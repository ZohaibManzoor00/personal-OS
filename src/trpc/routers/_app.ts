import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import z from "zod";

export const appRouter = createTRPCRouter({
  getWorkflows: protectedProcedure.query(async () => {
    const workflows = await prisma.workflow.findMany();
    return workflows;
  }),
  createWorkflow: protectedProcedure.input(z.object({ name: z.string() })).mutation(async () => {
    await inngest.send({
      name: "app/task.created",
      data: { id: "123", name: "John Doe" },
    });
    console.log("workflow created");

    await prisma.workflow.create({ data: { name: "test" } });
    console.log("workflow created in database");

    return { message: "Workflow created" };
  }),
});

export type AppRouter = typeof appRouter;
