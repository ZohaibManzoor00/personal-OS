"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useKnowledgeParams, useSearchFocusHotkey } from "../hooks/use-knowledge";
import { SearchKbd } from "./search-kbd";

export const KnowledgeSearch = () => {
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
    <div className="relative w-full max-w-md">
      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        className="bg-background pr-12 pl-9"
        placeholder="Search knowledge"
        value={value}
        onChange={(event) => setValue(event.target.value)}
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
