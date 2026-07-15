import { TRPCError } from "@trpc/server";
import z from "zod";
import { prisma } from "@/lib/db";
import { deleteObject, getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { ROUTE_COVER_KEYS } from "../lib/routes";

const routeKey = z.enum(ROUTE_COVER_KEYS);

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const buildCoverKey = ({
  userId,
  route,
  contentType,
}: {
  userId: string;
  route: string;
  contentType: string;
}) => {
  const ext = IMAGE_EXTENSIONS[contentType] ?? "bin";
  return `route-covers/${userId}/${route}/${crypto.randomUUID()}.${ext}`;
};

export const routeCoverRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ route: routeKey }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;
      return prisma.routeCover.findUnique({
        where: { userId_route: { userId, route: input.route } },
      });
    }),

  createUploadUrl: protectedProcedure
    .input(z.object({ route: routeKey, contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      if (!(input.contentType in IMAGE_EXTENSIONS)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported image type",
        });
      }

      const key = buildCoverKey({
        userId,
        route: input.route,
        contentType: input.contentType,
      });

      let uploadUrl: string | null = null;
      try {
        uploadUrl = (await getPresignedUploadUrl({
          key,
          contentType: input.contentType,
        })) as string;
      } catch (error) {
        console.error(error);
        uploadUrl = null;
      }

      return { uploadUrl, key, publicUrl: getPublicUrl(key) };
    }),

  attach: protectedProcedure
    .input(
      z.object({
        route: routeKey,
        storageKey: z.string(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      if (
        !input.storageKey.startsWith(`route-covers/${userId}/${input.route}/`)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid storage key",
        });
      }

      // One cover per (user, route): drop the previous object before swapping.
      const existing = await prisma.routeCover.findUnique({
        where: { userId_route: { userId, route: input.route } },
      });
      if (existing && existing.storageKey !== input.storageKey) {
        await deleteObject(existing.storageKey).catch(() => undefined);
      }

      const url = getPublicUrl(input.storageKey);

      return prisma.routeCover.upsert({
        where: { userId_route: { userId, route: input.route } },
        create: {
          userId,
          route: input.route,
          url,
          storageKey: input.storageKey,
          width: input.width,
          height: input.height,
        },
        update: {
          url,
          storageKey: input.storageKey,
          width: input.width,
          height: input.height,
        },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ route: routeKey }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;

      const existing = await prisma.routeCover.findUnique({
        where: { userId_route: { userId, route: input.route } },
      });
      if (existing) {
        await deleteObject(existing.storageKey).catch(() => undefined);
        await prisma.routeCover.delete({
          where: { userId_route: { userId, route: input.route } },
        });
      }

      return { route: input.route };
    }),
});
