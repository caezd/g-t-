"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchFull({
  placeholder = "Rechercher...",
  query,
  setQuery,
}: {
  placeholder?: string;
  query: string;
  setQuery: (v: string) => void;
}) {
  return (
    <div className="h-16 border-b flex items-center px-4 sm:px-6 lg:px-8 sticky top-0 bg-background z-10">
      <Search className="w-5 h-5 opacity-60 pointer-events-none" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        variant={"ghost"}
        className="flex-1 h-full focus-visible:outline-none pl-6"
      />
    </div>
  );
}
