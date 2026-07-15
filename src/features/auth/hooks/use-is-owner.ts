"use client";

import { authClient } from "@/lib/auth-client";
import { isOwnerEmail } from "@/lib/owner";

/**
 * Client-side view of who's browsing. `isOwner` gates every edit affordance in
 * the UI (the tRPC layer is the real security boundary). While the session is
 * still loading we report `isOwner: false` so controls never flash in for a
 * non-owner.
 */
export const useIsOwner = () => {
  const { data: session, isPending } = authClient.useSession();

  return {
    isOwner: isOwnerEmail(session?.user?.email),
    isAuthenticated: !!session,
    isPending,
  };
};
