"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useKnowledgeParams } from "../hooks/use-knowledge";

export const KnowledgeSearch = () => {
  const [params, setParams] = useKnowledgeParams();
  const [value, setValue] = useState(params.search);

  useEffect(() => {
    setValue(params.search);
  }, [params.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== params.search) setParams({ search: value });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, params.search, setParams]);

  return (
    <div className="relative w-full max-w-md">
      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="bg-background pl-9"
        placeholder="Search knowledge"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => setValue("")}
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-opacity hover:text-foreground",
          value ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
};
