import { requireAuth } from "@/lib/auth-utils";

interface Props {
  params: Promise<{ workflowId: string }>;
}

export default async function WorkflowDetailPage({ params }: Props) {
  await requireAuth();
  const { workflowId } = await params;
  return <div>WorkflowDetailPage {workflowId}</div>;
}
