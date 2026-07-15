import { KnowledgeSectionNodePage } from "@/features/knowledge/server/section-page";

interface Props {
  params: Promise<{ nodeId: string }>;
}

export default async function CareerNodePage({ params }: Props) {
  const { nodeId } = await params;
  return <KnowledgeSectionNodePage section="career" nodeId={nodeId} />;
}
