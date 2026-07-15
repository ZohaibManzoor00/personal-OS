"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useKnowledgeParams, useSearchFocusHotkey } from "../hooks/use-knowledge";
import { SearchKbd } from "./search-kbd";

export const KnowledgeSearch = ({ className }: { className?: string }) => {
  const [params, setParams] = useKnowledgeParams();
  const [value, setValue] = useState(params.search);
  const inputRef = useRef<HTMLInputElement>(null);

  useSearchFocusHotkey(inputRef);

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
    <div className={cn("relative w-full max-w-md", className)}>
      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        data-knowledge-search-input
        className="bg-background pr-12 pl-9"
        placeholder="Search learnings"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Tab" || event.shiftKey) return;
          const first = document.querySelector<HTMLElement>("[data-search-result]");
          if (first) {
            event.preventDefault();
            first.focus();
          }
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      ) : (
        <SearchKbd className="absolute top-1/2 right-2 -translate-y-1/2" />
      )}
    </div>
  );
};
