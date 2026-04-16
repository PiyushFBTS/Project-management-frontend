'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Megaphone, X, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import { announcementsApi } from '@/lib/api/announcements';
import { Announcement } from '@/types';
import { useAuth } from '@/providers/auth-provider';

const DISMISSED_KEY = 'announcementsDismissed';
const AUTOPLAY_MS = 3000;

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
 * Full-width carousel banner on the dashboard. When multiple announcements
 * are active, slides auto-advance every 3 seconds with a CSS translate
 * transition. Prev/next arrows and pagination dots let the user navigate
 * manually; hovering pauses auto-rotate. Dismissal is persisted per
 * `id:updatedAt` in localStorage so edits re-surface the banner.
 */
export function AnnouncementBanner() {
  const { user } = useAuth();

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements-active'],
    queryFn: () => announcementsApi.getActive().then((r) => r.data?.data ?? []),
    enabled: !!user,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 60 * 1000,
  });

  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, true>>(() => readDismissed());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

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

  // Auto-rotate every 3s while multiple are visible and the user isn't hovering
  useEffect(() => {
    if (visible.length <= 1 || paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % visible.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [visible.length, paused]);

  if (!mounted || visible.length === 0) return null;

  function goPrev() {
    setIndex((i) => (i - 1 + visible.length) % visible.length);
  }
  function goNext() {
    setIndex((i) => (i + 1) % visible.length);
  }
  function dismiss(a: Announcement) {
    const key = `${a.id}:${a.updatedAt}`;
    const next = { ...dismissed, [key]: true as const };
    setDismissed(next);
    writeDismissed(next);
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-rose-500/20 shadow-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Sliding track — one slide per announcement */}
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {visible.map((a) => (
          <Slide key={`${a.id}:${a.updatedAt}`} announcement={a} onDismiss={() => dismiss(a)} />
        ))}
      </div>

      {/* Prev / Next arrows */}
      {visible.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous announcement"
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next announcement"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </>
      )}

      {/* Pagination dots */}
      {visible.length > 1 && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {visible.map((a, i) => (
            <button
              key={`${a.id}:${a.updatedAt}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to announcement ${i + 1}`}
              className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Slide({ announcement, onDismiss }: { announcement: Announcement; onDismiss: () => void }) {
  const a = announcement;
  return (
    <div className="relative shrink-0 w-full bg-linear-to-br from-rose-600 via-pink-600 to-purple-700">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative flex items-start gap-3 px-6 sm:px-12 py-4 pb-7 pr-12 text-white">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">
              Announcement
            </p>
            <span className="flex items-center gap-1 text-[11px] text-white/80">
              <CalendarClock className="h-3 w-3" />
              Until {format(new Date(a.expiresOn), 'MMM d, yyyy')}
            </span>
          </div>
          <h3 className="mt-0.5 text-base sm:text-lg font-bold tracking-tight break-words">
            {a.title}
          </h3>
          <p className="mt-1 text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
            {a.description}
          </p>
          <p className="mt-1.5 text-[10px] text-white/70">— {a.createdByName}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/30 transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}
