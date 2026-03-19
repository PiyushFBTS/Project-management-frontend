'use client';

import { useRef, useState, KeyboardEvent, ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

export interface MentionEmployee {
  id: number;
  empName: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onMentionAdded?: (emp: MentionEmployee) => void;
  employees: MentionEmployee[];
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

/** Renders a stored @[empName](empId) token as a highlighted chip inside comment text. */
export function renderMentions(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /@\[([^\]]+)\]\(\d+\)/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`t-${idx++}`}>{content.slice(last, m.index)}</span>);
    }
    parts.push(
      <span
        key={`m-${idx++}`}
        className="inline-flex items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400"
      >
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(<span key={`t-${idx++}`}>{content.slice(last)}</span>);
  return parts;
}

/**
 * Transforms the display text (containing "@empName") back to the storage format
 * "@[empName](empId)" for each tracked mention before submitting.
 */
export function buildMentionContent(
  text: string,
  mentions: MentionEmployee[],
): string {
  let result = text;
  for (const emp of mentions) {
    // Escape special regex chars in the name, then replace @name (full word boundary)
    const escaped = emp.empName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(`@${escaped}(?=\\s|$)`, 'g'),
      `@[${emp.empName}](${emp.id})`,
    );
  }
  return result;
}

export function MentionTextarea({
  value,
  onChange,
  onMentionAdded,
  employees,
  placeholder,
  rows = 2,
  className,
  disabled,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<MentionEmployee[]>([]);
  const [triggerStart, setTriggerStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Deduplicate by id so admin-id / employee-id collisions never produce duplicate keys
  const uniqueEmployees = employees.filter(
    (emp, i, arr) => arr.findIndex((x) => x.id === emp.id) === i,
  );

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    onChange(val);

    const beforeCursor = val.slice(0, cursor);
    const match = /@(\w*)$/.exec(beforeCursor);
    if (match) {
      const partial = match[1].toLowerCase();
      const filtered = uniqueEmployees
        .filter((emp) => emp.empName.toLowerCase().includes(partial))
        .slice(0, 6);
      setSuggestions(filtered);
      setTriggerStart(match.index);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
      setTriggerStart(-1);
    }
  };

  const insertMention = (emp: MentionEmployee) => {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, triggerStart);
    const after = value.slice(cursor);
    // Only insert the readable name — no raw ID visible to the user
    const display = `@${emp.empName} `;
    const newValue = `${before}${display}${after}`;
    onChange(newValue);
    onMentionAdded?.(emp);
    setSuggestions([]);
    setTriggerStart(-1);
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + display.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (suggestions[selectedIndex]) insertMention(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setTriggerStart(-1);
    }
  };

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cn(
          'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className,
        )}
      />

      {suggestions.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 rounded-md border bg-popover shadow-lg overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b">
            Mention someone
          </p>
          {suggestions.map((emp, i) => (
            <button
              key={`emp-${emp.id}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(emp);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">
                {emp.empName[0]?.toUpperCase()}
              </div>
              {emp.empName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
