"use client";

import { useState, useMemo } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { prefixThenFuzzyFilter } from "@/lib/commandFilter"; // ou importe où tu l'as mis

type PrimitiveValue = string | number | null | undefined;

interface SearchableComboboxProps<T> {
  items: T[];
  /** valeur actuelle (id, slug, etc.) */
  value: PrimitiveValue;
  /** callback quand on change de valeur */
  onChange: (value: PrimitiveValue) => void;

  /** comment récupérer le label à afficher */
  getLabel: (item: T) => string;
  /** comment récupérer la value (id, etc.) */
  getValue: (item: T) => PrimitiveValue;

  /** texte dans le bouton quand rien n'est sélectionné */
  placeholder?: string;
  /** texte dans l’input de recherche */
  searchPlaceholder?: string;
  /** texte quand aucun résultat */
  emptyMessage?: string;

  disabled?: boolean;
}

export function SearchableCombobox<T>({
  items,
  value,
  onChange,
  getLabel,
  getValue,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  emptyMessage = "Aucun résultat.",
  disabled = false,
}: SearchableComboboxProps<T>) {
  const [open, setOpen] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => getValue(item) === value) ?? null,
    [items, value, getValue],
  );

  const buttonLabel = selectedItem ? getLabel(selectedItem) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between",
            !selectedItem && "text-muted-foreground",
          )}
        >
          {buttonLabel}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command filter={prefixThenFuzzyFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const itemValue = getValue(item);
                const label = getLabel(item);

                return (
                  <CommandItem
                    key={String(itemValue)}
                    // le filter utilise cette value (== label ici)
                    value={label}
                    onSelect={() => {
                      onChange(itemValue);
                      setOpen(false);
                    }}
                  >
                    {label}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        itemValue === value ? "opacity-100" : "opacity-0",
                      )}
                    />
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
