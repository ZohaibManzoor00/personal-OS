import { notFound } from "next/navigation";
import { getIsOwner } from "@/lib/auth-utils";

interface Props {
  params: Promise<{ executionId: string }>;
}

export default async function ExecutionDetailPage({ params }: Props) {
  if (!(await getIsOwner())) notFound();
  const { executionId } = await params;
  return <div>ExecutionDetailPage {executionId}</div>;
}
