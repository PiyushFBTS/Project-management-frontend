'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Megaphone, X, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import { announcementsApi } from '@/lib/api/announcements';
import { Announcement } from '@/types';
import { useAuth } from '@/providers/auth-provider';

const DISMISSED_KEY = 'announcementsDismissed';

function readDismissed(): Record<string, true> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeDismissed(map: Record<string, true>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
}

/**
 * Full-width banner shown on the dashboard (above the KPIs). Shows active
 * announcements one at a time; the user can dismiss them — dismissal is
 * persisted per-announcement-id in localStorage so it doesn't re-appear on
 * the same browser, even across refreshes. Editing the announcement on the
 * server (different `updatedAt`) makes it reappear so fresh content is seen.
 */
export function AnnouncementBanner() {
  const { user } = useAuth();

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements-active'],
    queryFn: () => announcementsApi.getActive().then((r) => r.data?.data ?? []),
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });

  // Lazy init from localStorage so the first paint already reflects prior dismissals.
  // `mounted` guards against SSR/hydration mismatch — nothing renders until client mount.
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, true>>(() => readDismissed());
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visible = useMemo(() => {
    return (announcements as Announcement[]).filter((a) => {
      const key = `${a.id}:${a.updatedAt}`;
      return !dismissed[key];
    });
  }, [announcements, dismissed]);

  useEffect(() => {
    if (index >= visible.length) setIndex(0);
  }, [visible.length, index]);

  if (!mounted || visible.length === 0) return null;
  const current = visible[index];

  function dismiss() {
    const key = `${current.id}:${current.updatedAt}`;
    const next = { ...dismissed, [key]: true as const };
    setDismissed(next);
    writeDismissed(next);
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-rose-500/20 bg-linear-to-br from-rose-600 via-pink-600 to-purple-700 shadow-md">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative flex items-start gap-3 px-4 sm:px-5 py-4 pr-10 text-white">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
          <Megaphone className="h-5 w-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">
              Announcement
            </p>
            {visible.length > 1 && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                {index + 1} / {visible.length}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-white/80">
              <CalendarClock className="h-3 w-3" />
              Until {format(new Date(current.expiresOn), 'MMM d, yyyy')}
            </span>
          </div>
          <h3 className="mt-0.5 text-base sm:text-lg font-bold tracking-tight break-words">
            {current.title}
          </h3>
          <p className="mt-1 text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
            {current.description}
          </p>
          <p className="mt-1.5 text-[10px] text-white/70">— {current.createdByName}</p>
        </div>

        {visible.length > 1 && (
          <div className="hidden sm:flex items-center gap-1 shrink-0 mt-1">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + visible.length) % visible.length)}
              aria-label="Previous announcement"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % visible.length)}
              aria-label="Next announcement"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/30 transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}
