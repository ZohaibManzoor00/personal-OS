import { requireAuth } from "@/lib/auth-utils";

export default async function WorkflowsPage() {
  await requireAuth()
  return <div>WorkflowsPage</div>;
}
