import { requireAuth } from "@/lib/auth-utils";

interface Props {
  params: Promise<{ executionId: string }>;
}

export default async function ExecutionDetailPage({ params }: Props) {
  await requireAuth();
  const { executionId } = await params;
  return <div>ExecutionDetailPage {executionId}</div>;
}
