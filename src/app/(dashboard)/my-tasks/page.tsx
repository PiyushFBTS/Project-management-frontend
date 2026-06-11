'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Redirect stub. The "My Tickets" surface lives at /tickets?view=my now;
 * this path stays alive for old bookmarks, dashboard quick-links, and
 * sidebar entries that haven't been updated yet. Any inbound query
 * params (e.g. `?projectId=…`) carry through to the consolidated page.
 */
function MyTasksRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'my');
    router.replace(`/tickets?${params.toString()}`);
  }, [router, searchParams]);

  return null;
}

export default function MyTasksPage() {
  return (
    <Suspense fallback={null}>
      <MyTasksRedirect />
    </Suspense>
  );
}
