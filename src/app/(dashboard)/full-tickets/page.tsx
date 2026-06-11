'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Redirect stub. The "Tickets Log" surface lives at /tickets?view=log
 * now; this path stays alive for old bookmarks and the client-profile
 * "View Ticket Log" deeplink (which passes `?projectId=…`). Query
 * params carry through to the consolidated page so the inbound filter
 * still applies.
 *
 * The ticket detail page at /full-tickets/[id] is unchanged — only the
 * list view consolidated.
 */
function FullTicketsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'log');
    router.replace(`/tickets?${params.toString()}`);
  }, [router, searchParams]);

  return null;
}

export default function FullTicketsPage() {
  return (
    <Suspense fallback={null}>
      <FullTicketsRedirect />
    </Suspense>
  );
}
