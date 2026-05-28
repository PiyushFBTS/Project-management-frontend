'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { salarySlipsApi, type SalarySlip } from '@/lib/api/salary-slips';
import { Skeleton } from '@/components/ui/skeleton';
import { SalarySlipForm } from '../_components/salary-slip-form';

/**
 * /employees/[id]/salary-slips/new
 *
 * Pre-fetches the most-recent slip for this employee so the form can
 * carry-over the salary structure when generating the next month. The
 * form treats a missing template as "first slip ever" and falls back
 * to the employee record for whatever fields it can derive there.
 *
 * We wait for the latest-slip fetch (a few hundred ms at most) before
 * rendering the form so the carry-over banner + initial state are both
 * populated on first paint — flashing in "carry-over applied" after
 * the form is already half-filled would be jarring.
 */
export default function NewSalarySlipPage() {
  return (
    <Suspense fallback={null}>
      <NewSalarySlipPageInner />
    </Suspense>
  );
}

function NewSalarySlipPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const targetType = searchParams.get('targetType') ?? 'employee';
  const employeeId = Number(id);

  const { data: latest, isLoading } = useQuery<SalarySlip | null>({
    queryKey: ['salary-slip-latest', employeeId],
    queryFn: async () => {
      const r = await salarySlipsApi.getLatestForEmployee(employeeId);
      // Backend wraps the payload in { success, data }; data is null
      // for first-time employees. Both unwrappings are safe.
      return (r.data?.data ?? r.data ?? null) as SalarySlip | null;
    },
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <SalarySlipForm
      employeeId={employeeId}
      targetType={targetType}
      templateSlip={latest ?? null}
    />
  );
}
