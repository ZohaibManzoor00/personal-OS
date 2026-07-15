"use client";

import Link from "next/link";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAncestors } from "../hooks/use-knowledge";
import { useKnowledgeSection } from "./knowledge-section-context";

export const KnowledgeBreadcrumb = ({ nodeId }: { nodeId: string }) => {
  const section = useKnowledgeSection();
  const { data: ancestors } = useAncestors(nodeId);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={section.basePath}>{section.label}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {ancestors.map((node, index) => {
          const isLast = index === ancestors.length - 1;

          return (
            <Fragment key={node.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{node.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={`${section.basePath}/${node.id}`}>{node.title}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
