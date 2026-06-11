'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ListTodo, Ticket } from 'lucide-react';
import { MyTicketsView } from './_components/my-tickets-view';
import { TicketsLogView } from './_components/tickets-log-view';

type TabKey = 'my' | 'log';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Ticket }> = [
  { key: 'my', label: 'My Tickets', icon: ListTodo },
  { key: 'log', label: 'Tickets Log', icon: Ticket },
];

function TicketsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `?view=…` drives the tab. Default to "my" for first-time visitors.
  // Unknown values fall back to "my" rather than erroring out so a
  // mistyped deeplink still lands somewhere usable.
  const rawView = searchParams.get('view');
  const activeTab: TabKey = rawView === 'log' ? 'log' : 'my';

  const setTab = useCallback(
    (next: TabKey) => {
      // Preserve every other query param (e.g. `projectId` deeplinked
      // by the client-profile "View Ticket Log" button) so switching
      // tabs doesn't clobber an inbound filter.
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', next);
      // replace, not push — we don't want each tab toggle to add a
      // browser history entry the user has to click "back" through.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="space-y-4">
      {/* Shared gradient header. Subtitle changes per tab so the page
          identity stays clear without re-rendering the whole chrome. */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-teal-600 via-cyan-600 to-blue-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Ticket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Tickets</h1>
            <p className="text-sm text-white/60">
              {activeTab === 'my' ? 'Your assigned tickets' : 'Every ticket across your projects'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab strip. Hand-rolled rather than pulling in the shadcn Tabs
          primitive — two buttons fit the page surface, and the URL
          (not internal state) is the source of truth. */}
      <div className="inline-flex rounded-xl border bg-card p-1 shadow-sm" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ' +
                (active
                  ? 'bg-linear-to-r from-teal-500 to-cyan-500 text-white shadow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted')
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Mount both views unconditionally and hide the inactive one
          rather than unmount/remount. Keeps each view's React Query
          cache warm, scroll positions intact, and filter state
          preserved when the user toggles back and forth. */}
      <div className={activeTab === 'my' ? '' : 'hidden'}>
        <MyTicketsView />
      </div>
      <div className={activeTab === 'log' ? '' : 'hidden'}>
        <TicketsLogView />
      </div>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={null}>
      <TicketsPageInner />
    </Suspense>
  );
}
