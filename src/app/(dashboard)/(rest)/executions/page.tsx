import { requireAuth } from "@/lib/auth-utils";

export default async function ExecutionsPage() {
  await requireAuth();
  return <div>ExecutionsPage</div>;
}
