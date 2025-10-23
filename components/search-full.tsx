import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchFull({ placeholder = "Rechercher...", query, setQuery }) {
    return (
        <div className="h-16 border-b flex items-center px-4 sm:px-6 lg:px-8 sticky top-0 bg-background z-10">
            <Search className="w-5 h-5 opacity-60 pointer-events-none" />
            <Input
                variant="ghost"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 h-full focus-visible:outline-none pl-6"
            />
        </div>
    );
}
