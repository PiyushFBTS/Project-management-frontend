/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { salarySlipsApi, type SalarySlip } from '@/lib/api/salary-slips';
import { SalarySlipForm } from '../../_components/salary-slip-form';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * /employees/[id]/salary-slips/[slipId]/edit
 *
 * Fetches the slip via the admin endpoint (this page is gated to
 * managers — admin/HR/accounts — so they're allowed) and hands it to
 * the shared form. The form renders read-only when the slip is
 * already published; unpublish first to edit.
 */
export default function EditSalarySlipPage() {
  return (
    <Suspense fallback={null}>
      <EditSalarySlipPageInner />
    </Suspense>
  );
}

function EditSalarySlipPageInner() {
  const { id, slipId } = useParams<{ id: string; slipId: string }>();
  const searchParams = useSearchParams();
  const targetType = searchParams.get('targetType') ?? 'employee';

  const { data, isLoading, isError } = useQuery<SalarySlip>({
    queryKey: ['salary-slip-edit', slipId],
    queryFn: async () => {
      const r = await salarySlipsApi.getOne(Number(slipId));
      return (r.data?.data ?? r.data) as SalarySlip;
    },
    enabled: !!slipId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Salary slip not found.
      </p>
    );
  }

  return (
    <SalarySlipForm
      employeeId={Number(id)}
      targetType={targetType}
      slip={data}
    />
  );
}
