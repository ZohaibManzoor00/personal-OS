import { KnowledgeSectionNodePage } from "@/features/knowledge/server/section-page";

interface Props {
  params: Promise<{ nodeId: string }>;
}

export default async function ProjectsNodePage({ params }: Props) {
  const { nodeId } = await params;
  return <KnowledgeSectionNodePage section="projects" nodeId={nodeId} />;
}
