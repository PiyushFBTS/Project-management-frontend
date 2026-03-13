'use client';

import * as React from 'react';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [openUpward, setOpenUpward] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (disabled) return;

    if (!open) {
      // Check available space below vs above
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // Dropdown is ~260px tall (200px list + search bar)
        setOpenUpward(spaceBelow < 280 && spaceAbove > spaceBelow);
      }
      setTimeout(() => inputRef.current?.focus(), 0);
    }

    setOpen(!open);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={cn(
          'border-input flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm text-left shadow-xs',
          'hover:bg-accent/50 transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'h-9',
        )}
      >
        <span className={cn('truncate text-left', !selectedLabel && 'text-muted-foreground')}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              className="text-muted-foreground hover:text-foreground rounded-sm p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onValueChange('');
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown className="size-4 opacity-50" />
        </div>
      </button>

      {open && (
        <div
          className={cn(
            'bg-popover text-popover-foreground absolute z-50 w-full min-w-[220px] rounded-md border shadow-md animate-in fade-in-0 zoom-in-95',
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {/* Search input */}
          <div className="flex items-center border-b px-2 py-1.5">
            <Search className="text-muted-foreground mr-2 size-4 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground ml-1">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-sm">No results found</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-left outline-hidden select-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    value === option.value && 'bg-accent/50',
                  )}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && (
                    <span className="absolute right-2 flex size-3.5 items-center justify-center">
                      <Check className="size-4" />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
