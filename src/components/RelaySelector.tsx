import React, { useState } from "react";
import { Check, ChevronsUpDown, Wifi, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useAppConfig } from "@/components/AppProvider";

interface RelaySelectorProps {
  className?: string;
}

export function RelaySelector({ className }: RelaySelectorProps) {
  const { config, availableRelays, isRelaySelected, toggleRelay, addCustomRelay } = useAppConfig();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const getRelayName = (url: string): string => {
    const option = availableRelays.find(o => o.url === url);
    if (option) return option.name;
    try {
      return url.replace(/^wss?:\/\//, '').replace(/\/$/, '');
    } catch {
      return url;
    }
  };

  const normalizeRelayUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    if (trimmed.includes('://')) return trimmed;
    return `wss://${trimmed}`;
  };

  const handleAddCustomRelay = (url: string) => {
    const normalizedUrl = normalizeRelayUrl(url);
    if (normalizedUrl) {
      addCustomRelay(normalizedUrl);
      setInputValue("");
    }
  };

  const isValidRelayInput = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const normalized = normalizeRelayUrl(trimmed);
    try {
      new URL(normalized);
      return true;
    } catch {
      return false;
    }
  };

  // Custom relays that are not in RELAY_OPTIONS
  const customRelays = config.relayUrls.filter(
    url => !availableRelays.some(o => o.url === url)
  );

  const selectedCount = config.relayUrls.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {selectedCount === 0
                ? "Select relays..."
                : selectedCount === 1
                ? getRelayName(config.relayUrls[0])
                : `${selectedCount} relays`}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or add relay URL..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue && isValidRelayInput(inputValue) ? (
                <CommandItem
                  onSelect={() => {
                    handleAddCustomRelay(inputValue);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-2"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add relay</span>
                    <span className="text-xs text-muted-foreground">
                      {normalizeRelayUrl(inputValue)}
                    </span>
                  </div>
                </CommandItem>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {inputValue ? "Invalid relay URL" : "No relay found."}
                </div>
              )}
            </CommandEmpty>

            {/* Known relays */}
            <CommandGroup heading="Known Relays">
              {availableRelays
                .filter((option) =>
                  !inputValue ||
                  option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                  option.url.toLowerCase().includes(inputValue.toLowerCase())
                )
                .map((option) => (
                  <CommandItem
                    key={option.url}
                    value={option.url}
                    onSelect={() => toggleRelay(option.url)}
                    className="cursor-pointer"
                  >
                    <Checkbox
                      checked={isRelaySelected(option.url)}
                      className="mr-2"
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium">{option.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{option.url}</span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>

            {/* Custom relays */}
            {customRelays.length > 0 && (
              <CommandGroup heading="Custom Relays">
                {customRelays
                  .filter((url) =>
                    !inputValue ||
                    url.toLowerCase().includes(inputValue.toLowerCase())
                  )
                  .map((url) => (
                    <CommandItem
                      key={url}
                      value={url}
                      onSelect={() => toggleRelay(url)}
                      className="cursor-pointer"
                    >
                      <Checkbox
                        checked={isRelaySelected(url)}
                        className="mr-2"
                      />
                      <span className="flex-1 text-sm truncate">{url}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {/* Add custom relay from search input */}
            {inputValue && isValidRelayInput(inputValue) && (
              <CommandItem
                onSelect={() => {
                  handleAddCustomRelay(inputValue);
                  setInputValue("");
                }}
                className="cursor-pointer border-t"
              >
                <Plus className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">Add {normalizeRelayUrl(inputValue)}</span>
                </div>
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
