import { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebouncedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  showClearButton?: boolean;
}

/**
 * A search input that debounces the onChange callback to reduce
 * the number of queries triggered during typing.
 */
const DebouncedSearchInput = ({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  debounceMs = 300,
  showClearButton = true,
}: DebouncedSearchInputProps) => {
  // Local state for immediate UI feedback
  const [localValue, setLocalValue] = useState(value);

  // Sync local value when external value changes (e.g., on clear from parent)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced callback
  useEffect(() => {
    // Don't trigger on initial mount if values are already synced
    if (localValue === value) return;

    const timer = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [localValue, debounceMs, onChange, value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        className={cn("pl-10", showClearButton && localValue && "pr-10")}
      />
      {showClearButton && localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default DebouncedSearchInput;
