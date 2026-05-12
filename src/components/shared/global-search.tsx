'use client';

/**
 * Global command-palette-style search for the dashboard.
 *
 * Architecture:
 *   <GlobalSearchProvider>            ← mount once in (dashboard)/layout
 *     ├─ owns open/close state
 *     ├─ listens for Cmd/Ctrl+K (toggle) and Esc (close)
 *     ├─ exposes `useGlobalSearch().open()` so the header button works
 *     └─ renders the palette dialog
 *
 * UX choices that make this feel production-grade:
 *   • 250ms debounce on keystrokes — no fetch per character
 *   • Each request carries an AbortController so a stale response can't
 *     overwrite a newer one
 *   • Keyboard nav: ↑ / ↓ (flat across all groups), Enter to open,
 *     Esc to close. Mouse hover also moves the highlight.
 *   • Results group by type (Tickets, Employees, Projects) with empty
 *     groups hidden. <2-char queries show a "Type at least 2 characters"
 *     hint instead of a spinner.
 *   • Recent searches (last 5) persisted to localStorage and shown when
 *     the input is empty.
 *   • Click-outside / Esc fully closes and resets selection.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
// Project uses the unified `radix-ui` package (see components/ui/dialog.tsx).
import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  Search, X, Ticket, Users, FolderKanban, Loader2, Clock,
  ChevronRight, Hash, ArrowRight, CornerDownLeft,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import {
  searchApi,
  type GlobalSearchResults,
  type SearchTicket,
  type SearchEmployee,
  type SearchProject,
} from '@/lib/api/search';

// ── Context ──────────────────────────────────────────────────────────────────

interface GlobalSearchContextValue {
  open: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

export function useGlobalSearch(): GlobalSearchContextValue {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) {
    // Allow header/components to render even if the provider is missing
    // (e.g. on a non-dashboard route) — no-op fallback.
    return { open: () => {} };
  }
  return ctx;
}

// ── Recent-searches helper (localStorage) ───────────────────────────────────

const RECENT_KEY = 'globalSearch:recent';
const RECENT_LIMIT = 5;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  if (typeof window === 'undefined') return;
  const trimmed = q.trim();
  if (!trimmed) return;
  const existing = readRecent().filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...existing].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
}

// ── Debounce hook ────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Result-item helpers ─────────────────────────────────────────────────────

interface FlatResult {
  type: 'ticket' | 'employee' | 'project';
  id: number;
  href: string;
  // Original record so renderers can show type-specific bits.
  data: SearchTicket | SearchEmployee | SearchProject;
}

function flattenResults(r: GlobalSearchResults): FlatResult[] {
  const out: FlatResult[] = [];
  for (const t of r.tickets) {
    out.push({ type: 'ticket', id: t.id, href: `/full-tickets/${t.id}`, data: t });
  }
  for (const e of r.employees) {
    out.push({ type: 'employee', id: e.id, href: `/employees/${e.id}`, data: e });
  }
  for (const p of r.projects) {
    out.push({ type: 'project', id: p.id, href: `/projects/${p.id}`, data: p });
  }
  return out;
}

// Light highlight: bold the matching substring case-insensitively.
function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-500/15 text-blue-700 dark:text-blue-300 px-0.5 rounded-sm">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ── The provider + palette ──────────────────────────────────────────────────

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebouncedValue(query, 250);

  const openPalette = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    setActiveIdx(0);
    setRecent(readRecent());
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Clients don't get a global palette in v1 — backend would reject and
  // their visibility is narrow enough that the dashboard tiles suffice.
  const isClient = user?._type === 'client';

  // ── Cmd/Ctrl+K listener ──
  useEffect(() => {
    if (isClient) return;
    const handler = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, openPalette, closePalette, isClient]);

  // ── Run the search on debounced-query change ──
  useEffect(() => {
    if (!open) return;
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    searchApi
      .global(q, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const data: GlobalSearchResults =
          (res.data as any)?.data ?? (res.data as any) ?? {
            query: q, tickets: [], employees: [], projects: [],
          };
        setResults(data);
        setActiveIdx(0);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Search failed — try again';
        setError(msg);
        setResults(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, open]);

  // Flatten for keyboard navigation
  const flat = useMemo(() => (results ? flattenResults(results) : []), [results]);

  // Scroll active row into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx, open]);

  const goto = useCallback(
    (href: string, persistQuery?: string) => {
      if (persistQuery) pushRecent(persistQuery);
      closePalette();
      router.push(href);
    },
    [closePalette, router],
  );

  // ── Input keydown — drives keyboard nav ──
  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (flat.length === 0) {
        // Enter on a recent search re-runs that query.
        if (e.key === 'Enter' && query.trim().length < 2 && recent.length > 0) {
          e.preventDefault();
          setQuery(recent[0]);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = flat[activeIdx];
        if (target) goto(target.href, query);
      }
    },
    [flat, activeIdx, goto, query, recent],
  );

  // ── Render ──

  const ctxValue: GlobalSearchContextValue = useMemo(
    () => ({ open: openPalette }),
    [openPalette],
  );

  return (
    <GlobalSearchContext.Provider value={ctxValue}>
      {children}

      {/* Palette dialog — using Radix directly so we can pin the panel
          near the top of the viewport instead of dead-center. */}
      <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? openPalette() : closePalette())}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-[min(680px,calc(100vw-2rem))] rounded-xl bg-background border border-border/60 shadow-2xl overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Title className="sr-only">Global search</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Search tickets, employees, and projects across your workspace.
            </DialogPrimitive.Description>

            {/* Search input row */}
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search tickets, employees, projects…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="off"
                spellCheck={false}
              />
              {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
              {query && !loading && (
                <button
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                Esc
              </kbd>
            </div>

            {/* Results body */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {/* < 2 chars → show recent + tip */}
              {query.trim().length < 2 && !loading && (
                <EmptyState
                  recent={recent}
                  onPickRecent={(q) => setQuery(q)}
                  onClearRecent={() => {
                    try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
                    setRecent([]);
                  }}
                />
              )}

              {/* Error */}
              {error && (
                <div className="p-6 text-center text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Empty result set */}
              {query.trim().length >= 2 && !loading && results && flat.length === 0 && !error && (
                <div className="p-10 text-center">
                  <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No results for &ldquo;{results.query}&rdquo;</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try a different keyword, or check the spelling.
                  </p>
                </div>
              )}

              {/* Result groups */}
              {results && flat.length > 0 && (
                <div className="py-2">
                  {results.tickets.length > 0 && (
                    <ResultGroup
                      title="Tickets"
                      icon={Ticket}
                      iconBg="bg-blue-500/10 text-blue-600"
                    >
                      {results.tickets.map((t, i) => {
                        const idx = i;
                        return (
                          <ResultRow
                            key={`ticket-${t.id}`}
                            active={activeIdx === idx}
                            onHover={() => setActiveIdx(idx)}
                            onClick={() => goto(`/full-tickets/${t.id}`, query)}
                            dataIdx={idx}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {t.ticketNumber ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-mono font-bold ring-1 ring-blue-500/20 shrink-0">
                                  <Hash className="h-2.5 w-2.5" />
                                  {t.ticketNumber.replace(/^#?/, '')}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground shrink-0">#{t.id}</span>
                              )}
                              <span className="text-sm font-medium truncate">{highlight(t.title, query)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-2">
                              {t.projectName && (
                                <span className="hidden sm:inline truncate max-w-[160px]">{t.projectName}</span>
                              )}
                              <StatusPill status={t.status} />
                              <ChevronRight className="h-3.5 w-3.5" />
                            </div>
                          </ResultRow>
                        );
                      })}
                    </ResultGroup>
                  )}

                  {results.employees.length > 0 && (
                    <ResultGroup
                      title="Employees"
                      icon={Users}
                      iconBg="bg-emerald-500/10 text-emerald-600"
                    >
                      {results.employees.map((emp, i) => {
                        const idx = results.tickets.length + i;
                        return (
                          <ResultRow
                            key={`emp-${emp.id}`}
                            active={activeIdx === idx}
                            onHover={() => setActiveIdx(idx)}
                            onClick={() => goto(`/employees/${emp.id}`, query)}
                            dataIdx={idx}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar name={emp.empName} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{highlight(emp.empName, query)}</p>
                                <p className="text-[11px] text-muted-foreground truncate font-mono">
                                  {emp.empCode} · {emp.email}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </ResultRow>
                        );
                      })}
                    </ResultGroup>
                  )}

                  {results.projects.length > 0 && (
                    <ResultGroup
                      title="Projects"
                      icon={FolderKanban}
                      iconBg="bg-violet-500/10 text-violet-600"
                    >
                      {results.projects.map((p, i) => {
                        const idx = results.tickets.length + results.employees.length + i;
                        return (
                          <ResultRow
                            key={`proj-${p.id}`}
                            active={activeIdx === idx}
                            onHover={() => setActiveIdx(idx)}
                            onClick={() => goto(`/projects/${p.id}`, query)}
                            dataIdx={idx}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300">
                                <FolderKanban className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{highlight(p.projectName, query)}</p>
                                {p.projectCode && (
                                  <p className="text-[11px] text-muted-foreground font-mono">{p.projectCode}</p>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </ResultRow>
                        );
                      })}
                    </ResultGroup>
                  )}
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <KbdKey>↑</KbdKey><KbdKey>↓</KbdKey> navigate
                </span>
                <span className="flex items-center gap-1">
                  <KbdKey><CornerDownLeft className="h-2.5 w-2.5" /></KbdKey> open
                </span>
                <span className="flex items-center gap-1">
                  <KbdKey>Esc</KbdKey> close
                </span>
              </div>
              {flat.length > 0 && (
                <span className="hidden sm:inline">{flat.length} result{flat.length === 1 ? '' : 's'}</span>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </GlobalSearchContext.Provider>
  );
}

// ── Small subcomponents ─────────────────────────────────────────────────────

function ResultGroup({
  title,
  icon: Icon,
  iconBg,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 pb-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        <span className={`flex h-4 w-4 items-center justify-center rounded ${iconBg}`}>
          <Icon className="h-2.5 w-2.5" />
        </span>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultRow({
  active,
  onHover,
  onClick,
  dataIdx,
  children,
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  dataIdx: number;
  children: React.ReactNode;
}) {
  return (
    <button
      data-idx={dataIdx}
      onMouseMove={onHover}
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
        active ? 'bg-blue-500/10 text-foreground' : 'hover:bg-accent/40'
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    todo:        { label: 'Todo',        cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20' },
    in_review:   { label: 'In Review',   cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/20' },
    done:        { label: 'Done',        cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20' },
    closed:      { label: 'Closed',      cls: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 ring-gray-500/20' },
  };
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-500/10 text-slate-700 ring-slate-500/20' };
  return (
    <span className={`hidden md:inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
      {initials || '?'}
    </div>
  );
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border bg-background min-w-4 h-4 px-1 text-[10px] font-mono">
      {children}
    </kbd>
  );
}

function EmptyState({
  recent,
  onPickRecent,
  onClearRecent,
}: {
  recent: string[];
  onPickRecent: (q: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <div className="px-4 py-6 space-y-4">
      {recent.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              <Clock className="h-3 w-3" /> Recent searches
            </p>
            <button
              onClick={onClearRecent}
              className="text-[10px] text-muted-foreground hover:text-foreground transition"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((q) => (
              <button
                key={q}
                onClick={() => onPickRecent(q)}
                className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs hover:bg-accent/50 hover:border-blue-500/30 transition"
              >
                <Search className="h-3 w-3 text-muted-foreground" />
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Tips
        </p>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <ArrowRight className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
            Type at least 2 characters to start searching.
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
            Searches scope to <strong className="text-foreground">tickets, employees, projects</strong> you can access.
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
            Ticket numbers (e.g. <code className="rounded bg-muted px-1 text-[11px]">BTW-005</code>) jump directly to the top.
          </li>
        </ul>
      </div>
    </div>
  );
}
