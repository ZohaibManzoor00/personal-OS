"use client";

import { expandAllFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { ChevronsDownUpIcon, ChevronsUpDownIcon, FileTextIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { Button } from "@/components/ui/button";
import type { KnowledgeTreeNode } from "../types";

type TreeItemData = {
  name: string;
  isFolder: boolean;
  children: string[];
  count: number;
};

const ROOT_ID = "__knowledge_root__";
const INDENT = 20;

type Props = {
  nodes: KnowledgeTreeNode[];
  rootId: string | null;
};

export const KnowledgeTree = ({ nodes, rootId }: Props) => {
  const router = useRouter();
  const [allExpanded, setAllExpanded] = useState(false);

  const items = useMemo(() => {
    const childrenByParent = new Map<string | null, string[]>();
    for (const node of nodes) {
      const siblings = childrenByParent.get(node.parentId) ?? [];
      siblings.push(node.id);
      childrenByParent.set(node.parentId, siblings);
    }

    const countDescendants = (id: string): number => {
      const children = childrenByParent.get(id) ?? [];
      return children.reduce((total, childId) => total + 1 + countDescendants(childId), 0);
    };

    const record: Record<string, TreeItemData> = {
      [ROOT_ID]: {
        name: "Knowledge",
        isFolder: true,
        children: childrenByParent.get(rootId) ?? [],
        count: 0,
      },
    };

    for (const node of nodes) {
      const isFolder = node.type === "SPACE";
      record[node.id] = {
        name: node.title,
        isFolder,
        children: isFolder ? (childrenByParent.get(node.id) ?? []) : [],
        count: isFolder ? countDescendants(node.id) : 0,
      };
    }

    return record;
  }, [nodes, rootId]);

  const tree = useTree<TreeItemData>({
    rootItemId: ROOT_ID,
    indent: INDENT,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().isFolder,
    onPrimaryAction: (item) => {
      if (!item.isFolder()) router.push(`/knowledge/${item.getId()}`);
    },
    dataLoader: {
      getItem: (id) => items[id],
      getChildren: (id) => items[id]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature, expandAllFeature],
  });

  useEffect(() => {
    tree.rebuildTree();
  }, [items, tree]);

  const toggleAll = () => {
    if (allExpanded) {
      tree.collapseAll();
      setAllExpanded(false);
    } else {
      tree.expandAll();
      setAllExpanded(true);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          {allExpanded ? <ChevronsDownUpIcon className="size-4" /> : <ChevronsUpDownIcon className="size-4" />}
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <Tree indent={INDENT} tree={tree}>
        {tree.getItems().map((item) => {
          const data = item.getItemData();
          if (!data) return null;

          const isFolder = item.isFolder();

          return (
            <TreeItem
              key={item.getId()}
              item={item}
              onDoubleClick={() => {
                if (isFolder) router.push(`/knowledge/${item.getId()}`);
              }}
            >
              <TreeItemLabel className="bg-transparent">
                <span className="flex items-center gap-2">
                  {isFolder ? (
                    item.isExpanded() ? (
                      <FolderOpenIcon className="pointer-events-none size-4 text-amber-500" />
                    ) : (
                      <FolderIcon className="pointer-events-none size-4 text-amber-500" />
                    )
                  ) : (
                    <FileTextIcon className="pointer-events-none size-4 text-blue-500" />
                  )}
                  {item.getItemName()}
                  {isFolder && data.count > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                      {data.count}
                    </span>
                  )}
                </span>
              </TreeItemLabel>
            </TreeItem>
          );
        })}
      </Tree>
    </div>
  );
};
