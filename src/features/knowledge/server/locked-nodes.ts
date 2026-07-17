import { prisma } from "@/lib/db";

/**
 * Whose content the reads serve, plus whether the viewer is the owner. Reads run
 * as the owner (a read-only public showcase); locked sections and locked nodes
 * are hidden from everyone but the owner.
 */
export type ReaderCtx = { ownerUserId: string | null; isOwner: boolean };

/**
 * Every node id that is locked OR nested (at any depth) inside a locked node.
 * Locking only flips the flag on the node itself, so non-owner reads must
 * exclude this whole subtree — otherwise a locked folder's children (which keep
 * `locked = false`) would still leak through search and the list/tree/dashboard
 * queries. Owners see everything, so this returns `[]` for them.
 */
export const lockedNodeIds = async (ctx: ReaderCtx): Promise<string[]> => {
  if (ctx.isOwner || !ctx.ownerUserId) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE locked_tree AS (
      SELECT "id" FROM "Node"
      WHERE "userId" = ${ctx.ownerUserId} AND "locked" = true
      UNION ALL
      SELECT child."id"
      FROM "Node" child
      JOIN locked_tree lt ON child."parentId" = lt."id"
    )
    SELECT "id" FROM locked_tree
  `;
  return rows.map((row) => row.id);
};
