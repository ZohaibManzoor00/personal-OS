import { TRPCError } from "@trpc/server";
import z from "zod";
import { isSectionLocked } from "@/features/knowledge/lib/sections";
import { prisma } from "@/lib/db";
import { createTRPCRouter, ownerProcedure, publicProcedure } from "@/trpc/init";

/**
 * The persisted Excalidraw scene. Kept permissive on purpose: Excalidraw element
 * and binary-file shapes are large and version-dependent, so we validate the
 * envelope (elements array, optional files map) and store the rest verbatim.
 */
const sceneSchema = z.object({
  elements: z.array(z.any()),
  files: z.record(z.string(), z.any()).optional(),
});

export type DiagramScene = z.infer<typeof sceneSchema>;

/**
 * Walks a node's parent chain to check whether any ancestor is locked, so a
 * non-owner can't reach a diagram embedded on a page nested inside a locked
 * folder. Mirrors the same guard in the knowledge router.
 */
const hasLockedAncestor = async (
  userId: string,
  parentId: string | null,
): Promise<boolean> => {
  let current = parentId;
  while (current) {
    const parent = await prisma.node.findFirst({
      where: { id: current, userId },
      select: { parentId: true, locked: true },
    });
    if (!parent) break;
    if (parent.locked) return true;
    current = parent.parentId;
  }
  return false;
};

export const diagramRouter = createTRPCRouter({
  /**
   * Load a diagram's scene for an embed. Public, like the knowledge reads — the
   * whole app is a read-only showcase until the owner signs in. A diagram tied
   * to a page inherits that page's visibility: a non-owner can never read one on
   * a locked page, a page in a locked section, or a page nested inside a locked
   * folder.
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.ownerUserId) throw new TRPCError({ code: "NOT_FOUND" });

      const diagram = await prisma.diagram.findFirst({
        where: { id: input.id, userId: ctx.ownerUserId },
        include: {
          node: { select: { locked: true, section: true, parentId: true } },
        },
      });
      if (!diagram) throw new TRPCError({ code: "NOT_FOUND" });

      if (!ctx.isOwner && diagram.node) {
        const { locked, section, parentId } = diagram.node;
        if (
          locked ||
          isSectionLocked(section) ||
          (await hasLockedAncestor(ctx.ownerUserId, parentId))
        ) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
      }

      return {
        id: diagram.id,
        title: diagram.title,
        nodeId: diagram.nodeId,
        scene: diagram.scene as DiagramScene,
      };
    }),

  /**
   * Create a diagram, optionally tied to a page and seeded with a scene (e.g.
   * from a Mermaid conversion). Returns the id the caller embeds in the body.
   */
  create: ownerProcedure
    .input(
      z.object({
        nodeId: z.string().nullish(),
        title: z.string().max(200).optional(),
        scene: sceneSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      // A node reference must belong to the owner; drop anything else so a
      // diagram never dangles off someone else's page.
      let nodeId: string | null = null;
      if (input.nodeId) {
        const node = await prisma.node.findFirst({
          where: { id: input.nodeId, userId },
          select: { id: true },
        });
        nodeId = node?.id ?? null;
      }

      return await prisma.diagram.create({
        data: {
          userId,
          nodeId,
          title: input.title,
          scene: input.scene ?? { elements: [] },
        },
      });
    }),

  /** Overwrite a diagram's scene. Owner-only — this is the "Save" action. */
  save: ownerProcedure
    .input(z.object({ id: z.string(), scene: sceneSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      await prisma.diagram.findFirstOrThrow({
        where: { id: input.id, userId },
        select: { id: true },
      });

      return await prisma.diagram.update({
        where: { id: input.id },
        data: { scene: input.scene },
      });
    }),
});
