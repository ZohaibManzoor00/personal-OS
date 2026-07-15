import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { isOwnerEmail } from "./owner";

export const requireAuth = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
};

export const requireUnauth = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
};

/** Current request's session, or null. Never redirects. */
export const getOptionalSession = async () => auth.api.getSession({ headers: await headers() });

/** Whether the current request is authenticated as the owner. */
export const getIsOwner = async () => {
  const session = await getOptionalSession();
  return isOwnerEmail(session?.user.email);
};
