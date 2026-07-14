import type { KnowledgeNode } from "../types";
import { KnowledgeCard } from "./knowledge-card";

export const KnowledgeGrid = ({ items }: { items: KnowledgeNode[] }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((node) => (
        <KnowledgeCard key={node.id} node={node} />
      ))}
    </div>
  );
};
