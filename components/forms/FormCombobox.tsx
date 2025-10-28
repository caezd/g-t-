import * as React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export function FormCombobox({
    value,
    onChange,
    items,
    placeholder = "Sélectionner…",
    disabled,
    className,
}: {
    value: string | null;
    onChange: (v: string | null) => void;
    items: { value: string; label: string }[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const selected = value ? items.find((i) => i.value === value)?.label : null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn("w-full justify-between", className)}
                >
                    <span className={cn(!selected && "text-muted-foreground")}>
                        {selected ?? placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Rechercher…" />
                    <CommandList>
                        <CommandEmpty>Aucun résultat</CommandEmpty>
                        <CommandGroup>
                            {items.map((i) => {
                                const active = i.value === (value ?? "");
                                return (
                                    <CommandItem
                                        key={i.value || "null"}
                                        value={i.label}
                                        onSelect={() => {
                                            onChange(
                                                active ? null : i.value || null
                                            );
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                active
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                        {i.label || "— Aucun —"}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
